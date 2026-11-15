/**
 * test-audit-round.mjs — Round A（0.1.10「不许说谎」）的回归测试
 *
 * 这三条断言对应 docs/17 Round A 的验收标准，任何一条红了就说明
 * 「系统开始说了它没有证据的话」或者「测量口径又歪了」。
 *
 * 运行：node app/scripts/test-audit-round.mjs
 */

import { Yin, WORK_RATE, downsample } from '../web/src/dsp/pitch.js';
import { analyzeSibilance } from '../web/src/dsp/sibilance.js';
import { computeSpectralVoice } from '../web/src/dsp/spectralVoice.js';
import { FS, genVowel, genS, genSil, concat } from './lib/synth.mjs';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) {
    console.log(`✅ ${msg}`);
  } else {
    console.error(`❌ ${msg}`);
    failed += 1;
  }
};

/* ------------------------------------------------------------------ *
 * A1 · YIN 必须喂够 yin.needed 个样本
 * ------------------------------------------------------------------ */
console.log('\n--- A1 · YIN 喂足样本后不应系统性偏高 ---');

{
  const yin = new Yin({ sampleRate: WORK_RATE, minHz: 65, maxHz: 600, threshold: 0.14, windowSize: 1024 });
  console.log(`   yin.needed = ${yin.needed} （windowSize ${yin.windowSize} + tauMax ${yin.tauMax}）`);

  let worst = 0;
  let worstF0 = 0;
  for (const f0 of [90, 110, 130, 150, 175, 200, 230, 262, 330, 392]) {
    const v = genVowel({ dur: 1.2, f0, formants: [[700, 80], [1200, 90], [2600, 120]], noise: 0.004 });
    const mid = v.pcm.subarray(Math.round(FS * 0.3), Math.round(FS * 0.9));
    const ds = downsample(mid, FS, WORK_RATE);
    const res = yin.detect(ds.subarray(Math.max(0, ds.length - yin.needed)));
    const err = res ? Math.abs(res.hz / f0 - 1) * 100 : Infinity;
    if (err > worst) { worst = err; worstF0 = f0; }
    console.log(`   ${String(f0).padStart(4)} Hz → ${res ? res.hz.toFixed(1) : '未检出'} Hz   误差 ${Number.isFinite(err) ? err.toFixed(2) : '∞'}%`);
  }
  ok(worst < 0.5, `全频段最大误差 ${worst.toFixed(2)}% (${worstF0} Hz) < 0.5%`);
}

/* ------------------------------------------------------------------ *
 * A3 · 没有浊音时，不许说「舒展」
 * ------------------------------------------------------------------ */
console.log('\n--- A3 · 无浊音输入必须报「未测出」，不能说好 ---');

{
  // 纯摩擦音：YIN 找不到周期，H1-H2 / Twang 都无从谈起
  const pcm = concat(genSil(0.3), genS(2.0), genSil(0.3));
  const sv = computeSpectralVoice(pcm, FS);
  console.log(`   measured=${sv.measured}  status="${sv.status}"  h1h2=${sv.h1h2Db}  twang=${sv.twangDb}`);
  ok(sv.measured === false, 'measured === false（没有证据就不认领结论）');
  ok(sv.status !== '舒展柔和', `status 不是「舒展柔和」（实际「${sv.status}」）`);
  ok(sv.isPressed === false && sv.isDuckVoice === false, '两个布尔量保持 false（表示"未标记"，不是"健康"）');
}

/* ------------------------------------------------------------------ *
 * A7 · 咝音时长必须是「最长连续段」
 * ------------------------------------------------------------------ */
console.log('\n--- A7 · 丝[s] 时长 = 最长连续摩擦段，不是累计 ---');

{
  // 真值：最长连续 3.0 s；累计摩擦 6.0 s
  const pcm = concat(
    genSil(0.3),
    genS(3.0),
    genVowel({ dur: 2.0, f0: 200, formants: [[700, 80], [1200, 90], [2600, 120]] }).pcm,
    genSil(0.15),
    genS(2.0),
    genSil(0.15),
    genS(1.0),
    genSil(0.3),
  );
  const r = analyzeSibilance(pcm, FS);
  console.log(`   结果: ${r ? JSON.stringify(r) : 'null'}`);
  ok(!!r, '能检出咝音');
  if (r) {
    ok(r.durationSec != null && Math.abs(r.durationSec - 3.0) < 0.2,
      `durationSec ≈ 3.0 s（实际 ${r.durationSec} s；旧实现会报 0.03 s 或 6.0 s）`);
    ok(r.totalSec != null && r.totalSec > r.durationSec,
      `totalSec (${r.totalSec} s) 与 durationSec 语义分开，累计 ≥ 最长连续`);
  }
}

/* ------------------------------------------------------------------ *
 * A2 · 16 kHz 输入不再整段失效
 * ------------------------------------------------------------------ */
console.log('\n--- A2 · 16 kHz 采样率下频谱模块仍能出数 ---');

{
  const fsLo = 16000;
  const v = genVowel({ dur: 2.0, f0: 200, noise: 0.003, fs: fsLo });
  const sv = computeSpectralVoice(v.pcm, fsLo);
  console.log(`   measured=${sv.measured}  h1h2=${sv.h1h2Db}  twang=${sv.twangDb}`);
  ok(sv.measured === true, '16 kHz 输入仍能测出 H1-H2（旧实现恒为 null）');
}

/* ------------------------------------------------------------------ *
 * B2 · H1−H2 共振峰污染守卫
 * ------------------------------------------------------------------ */
console.log('\n--- B2 · 谐波压在共振峰上时，不许给 H1-H2 结论 ---');

{
  // /i/：真值 F1≈395，f0=200 时 H2 正好落在 F1 上 → 这一帧的 H1−H2 量的是共振峰增益差
  const vi = genVowel({ dur: 2.5, f0: 200, formants: [[395, 60], [2525, 120], [3250, 160], [3900, 200]], noise: 0.002 });
  const yi = computeSpectralVoice(vi.pcm, FS, { vowelF1s: [395] });
  console.log(`   /i/ F1=395 f0=200: measured=${yi.measured} H1H2=${yi.h1h2Db} 保留=${yi.h1h2Frames}/${yi.framesVoiced}`);
  ok(yi.measured === false && yi.h1h2Db === null, '/i/ 上不给 H1-H2（谐波压 F1），报「未测出」');
  ok(yi.h1h2SkippedFormant > 0, `丢弃原因被记录下来（${yi.h1h2SkippedFormant} 帧）`);

  // /a/：F1≈915，2f0=400 离得远 → 应当正常测出
  const va = genVowel({ dur: 2.5, f0: 200, formants: [[915, 80], [1450, 100], [2800, 140], [3800, 180]], noise: 0.002 });
  const ya = computeSpectralVoice(va.pcm, FS, { vowelF1s: [915] });
  console.log(`   /a/ F1=915 f0=200: measured=${ya.measured} H1H2=${ya.h1h2Db} 保留=${ya.h1h2Frames}/${ya.framesVoiced}`);
  ok(ya.measured === true && ya.h1h2Db != null, '/a/ 上照常给出 H1-H2');

  // 不传 vowelF1s 时行为不变（旧调用点不受影响）
  const y0 = computeSpectralVoice(va.pcm, FS);
  ok(y0.h1h2Frames === ya.h1h2Frames, '不传 vowelF1s 时不做排除，行为与旧版一致');
}

console.log('');
if (failed) {
  console.error(`❌ ${failed} 条断言失败 (AUDIT_ROUND_FAIL)`);
  process.exit(1);
}
console.log('✅ 全部通过 (AUDIT_ROUND_OK)');
