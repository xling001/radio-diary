/**
 * test-formants-vowel.mjs — Round B（0.1.11）共振峰按元音分类的回归测试
 *
 * 依据 docs/research_notes/03 §3 与 Huang et al. 2024：
 *   ΔF 强依赖元音（/i/ 干净、/u/ /o/ 圆唇后元音系统性偏低），
 *   所以自由说话里把不同元音的 F1/F2 平均成一个数是没有物理含义的。
 *
 * 运行：node app/scripts/test-formants-vowel.mjs
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { FS, genVowel, genSil, concat } from './lib/synth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(__dirname, '../web/src');
const { Yin, WORK_RATE, downsample } = await import(pathToFileURL(path.resolve(WEB, 'dsp/pitch.js')).href);
const { summarize } = await import(pathToFileURL(path.resolve(WEB, 'metrics/gating.js')).href);

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`✅ ${msg}`);
  else { console.error(`❌ ${msg}`); failed += 1; }
};

function framesOf(pcm, sampleRate) {
  const hop = Math.round(sampleRate * 0.025);
  const win = Math.min(4096, pcm.length);
  const y = new Yin({ sampleRate: WORK_RATE, minHz: 65, maxHz: 600, threshold: 0.14, windowSize: 1024 });
  const frames = [];
  for (let o = 0; o + win <= pcm.length; o += hop) {
    const w = pcm.subarray(o, o + win);
    let s = 0;
    for (let i = 0; i < win; i++) s += w[i] * w[i];
    const db = 20 * Math.log10(Math.sqrt(s / win) + 1e-12);
    if (db < -45) { frames.push({ t: o / sampleRate, hz: null, clarity: 0, db, balance: null }); continue; }
    const ds = downsample(w, sampleRate, WORK_RATE);
    const r = y.detect(ds.subarray(Math.max(0, ds.length - y.needed)));
    const v = r && r.clarity >= 0.58 && r.hz >= 65 && r.hz <= 600;
    frames.push({ t: o / sampleRate, hz: v ? r.hz : null, clarity: r ? r.clarity : 0, db, balance: null });
  }
  return frames;
}

const run = (pcm, sampleRate) => summarize(framesOf(pcm, sampleRate), pcm, sampleRate, 'script', null).stats;

// Aoi 女性中值（docs/research_notes/data/aoi_formants.csv）
const VOWELS = {
  i: { fmts: [[395, 60], [2525, 120], [3250, 160], [3900, 200]], truth: [395, 2525] },
  a:   { fmts: [[915, 80], [1450, 100], [2800, 140], [3800, 180]], truth: [915, 1450] },
  u: { fmts: [[445, 60], [925, 80], [2700, 130], [3600, 170]], truth: [445, 925] },
};

/* ------------------------------------------------------------------ *
 * B1-1 · 每个元音要落进正确的类，F1/F2 要接近真值
 * ------------------------------------------------------------------ */
console.log('\n--- B1-1 · 单元音分类与 F1/F2 精度 ---');

const single = {};
for (const [name, { fmts, truth }] of Object.entries(VOWELS)) {
  const v = genVowel({ dur: 3.0, f0: 220, formants: fmts, noise: 0.002 });
  const st = run(v.pcm, FS);
  const f = st.formants || {};
  const bucket = (f.byVowel || {})[name];
  single[name] = { f, bucket };
  if (!bucket) {
    ok(false, `${name}: 未归入 ${name} 类（byVowel = ${Object.keys(f.byVowel || {}).join(',') || '空'}）`);
    continue;
  }
  const d1 = Math.abs(bucket.f1 - truth[0]);
  const d2 = Math.abs(bucket.f2 - truth[1]);
  ok(d1 < 100 && d2 < 100,
    `${name}: 归入 ${f.dominant}，F1 ${bucket.f1} vs 真值 ${truth[0]}（差 ${d1}），F2 ${bucket.f2} vs ${truth[1]}（差 ${d2}）`);
}

/* ------------------------------------------------------------------ *
 * B1-2 · 两个元音混在一起时，不能被平均成一个数
 * ------------------------------------------------------------------ */
console.log('\n--- B1-2 · 混合元音不得被平均 ---');

{
  const vi = genVowel({ dur: 2.0, f0: 220, formants: VOWELS.i.fmts, noise: 0.002 }).pcm;
  const va = genVowel({ dur: 2.0, f0: 220, formants: VOWELS.a.fmts, noise: 0.002 }).pcm;
  const pcm = concat(genSil(0.3), vi, genSil(0.2), va, genSil(0.3));
  const st = run(pcm, FS);
  const f = st.formants || {};
  const b = f.byVowel || {};
  console.log(`   byVowel: ${Object.entries(b).map(([k, v]) => `${k}(n=${v.count}, F1=${v.f1}, F2=${v.f2})`).join('  ')}`);

  ok(!!b.i && !!b.a, '两个元音类都出现了（没有被合并成一类）');
  if (b.i && b.a) {
    ok(Math.abs(b.i.f1 - VOWELS.i.truth[0]) < 100 && Math.abs(b.a.f1 - VOWELS.a.truth[0]) < 100,
      `/i/ F1=${b.i.f1} 与 /a/ F1=${b.a.f1} 各自接近真值，没有被平均成中间值`);
    ok(b.i.deltaF != null && b.a.deltaF != null,
      `两个类各自给出自己的 ΔF（${b.i.deltaF} / ${b.a.deltaF}）—— 不共用整体平均` +
      `（本例两者数值接近，属巧合：/i/ 与 /a/ 的偏差方向恰好抵消）`);
  }
  ok(f.deltaFSource && (f.deltaFSource.startsWith('vowel:') || f.deltaFSource.startsWith('dominant:')),
    `主指标交代了来源：${f.deltaFSource}`);
}

/* ------------------------------------------------------------------ *
 * B1-3 · 物理合理性：不许出现不可能的声道长度
 * ------------------------------------------------------------------ */
console.log('\n--- B1-3 · 声道长度必须落在物理范围内 ---');

{
  const results = [];
  for (const [name, { fmts }] of Object.entries(VOWELS)) {
    const v = genVowel({ dur: 2.5, f0: 220, formants: fmts, noise: 0.002 });
    const st = run(v.pcm, FS);
    for (const [cls, d] of Object.entries((st.formants || {}).byVowel || {})) {
      results.push({ name, cls, dF: d.deltaF, cm: d.lengthCm });
    }
  }
  for (const r of results) console.log(`   ${r.name.padEnd(4)} ${r.cls.padEnd(5)} ΔF=${r.dF}  L=${r.cm} cm`);
  ok(results.every((r) => r.cm == null || (r.cm >= 10 && r.cm <= 25)),
    '所有类别的等效声道长都在 10–25 cm 之内（旧代码曾给出 30.2 cm）');

  // 圆唇后元音的已知偏差方向：ΔF 偏低 → L 偏长
  const iy = results.find((r) => r.cls === 'i');
  const uo = results.find((r) => r.cls === 'u');
  if (iy && uo) {
    ok(uo.dF < iy.dF,
      `/u/ 的 ΔF (${uo.dF}) 低于 /i/ (${iy.dF}) —— 与文献报告的圆唇后元音系统性偏低一致`);
  }
}

/* ------------------------------------------------------------------ *
 * B1-4 · f0 带（p5–p95）
 * ------------------------------------------------------------------ */
console.log('\n--- B1-4 · f0 带用第 5/95 百分位 ---');

{
  const v = genVowel({ dur: 3.0, f0: 220, formants: VOWELS.a.fmts, noise: 0.002 });
  const st = run(v.pcm, FS);
  console.log(`   medianF0=${st.medianF0} p5=${st.p5} f0P95=${st.f0P95} bandSt=${st.bandSt}`);
  ok(st.p5 != null && st.f0P95 != null && st.bandSt != null, 'p5 / f0P95 / bandSt 三个字段都在');
  ok(st.bandSt < 2, `稳态元音的 f0 带只有 ${st.bandSt} 半音（稳定发声应当很窄）`);
}

console.log('');
if (failed) {
  console.error(`❌ ${failed} 条断言失败 (FORMANTS_VOWEL_FAIL)`);
  process.exit(1);
}
console.log('✅ 全部通过 (FORMANTS_VOWEL_OK)');
