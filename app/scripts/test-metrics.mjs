/* ===========================================================
   test-metrics.mjs — 用合成帧验证门控与统计

   不起浏览器，直接喂 {t, hz, clarity, db} 序列，
   看 summarize() 的判断是否合理。

   用法： node scripts/test-metrics.mjs
   =========================================================== */

import { summarize, compareToBaseline, MDC, GATE } from '../web/src/metrics/gating.js';
import { median } from '../web/src/dsp/pitch.js';

const STEP = 0.025;   // 采集步长 25ms

/** 造一段帧序列 */
function makeFrames({ seconds, hz = 220, jitterHz = 8, db = -20, clarity = 0.9, silence = false }) {
  const n = Math.round(seconds / STEP);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i * STEP;
    if (silence) {
      out.push({ t, hz: null, clarity: 0, db: -70 });
      continue;
    }
    const wobble = Math.sin(i * 0.37) * jitterHz + (Math.random() - 0.5) * 3;
    out.push({ t, hz: hz + wobble, clarity, db: db + (Math.random() - 0.5) * 2 });
  }
  return out;
}

let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  OK   ${name}${detail ? '  ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? '  ' + detail : ''}`); }
}

console.log('\n[1] 正常的 5 秒录音');
{
  const r = summarize(makeFrames({ seconds: 5, hz: 220 }));
  check('判定为可用', r.ok === true, `reasons=${JSON.stringify(r.reasons)}`);
  check('中位音高接近 220', Math.abs(r.stats.medianF0 - 220) < 6, `实测 ${r.stats.medianF0}`);
  check('音域是正数', r.stats.spanSt > 0, `${r.stats.spanSt} 半音`);
  check('时长记录正确', Math.abs(r.stats.durationSec - 5) < 0.2, `${r.stats.durationSec}s`);
}

console.log('\n[2] 太短（0.6 秒）');
{
  const r = summarize(makeFrames({ seconds: 0.6 }));
  check('判定为不可用', r.ok === false);
  check('给出"太短"的理由', r.reasons.some((x) => x.includes('太短')), r.reasons.join(' / '));
}

console.log('\n[3] 全程静音');
{
  const r = summarize(makeFrames({ seconds: 4, silence: true }));
  check('判定为不可用', r.ok === false);
  check('没有可用的统计', r.stats === null || r.stats.voicedCount < 15);
}

console.log('\n[4] 声音太小声（-50 dB 峰值）');
{
  const r = summarize(makeFrames({ seconds: 4, db: -50 }));
  check('判定为不可用', r.ok === false, r.reasons.join(' / '));
}

console.log('\n[5] 可信度低的帧不算数');
{
  const noisy = makeFrames({ seconds: 4, clarity: 0.3 });
  const r = summarize(noisy);
  check('判定为不可用', r.ok === false, r.reasons.join(' / '));
}

console.log('\n[6] MDC：小幅波动不该算变化');
{
  const a = summarize(makeFrames({ seconds: 4, hz: 220 })).stats;
  const b = summarize(makeFrames({ seconds: 4, hz: 226 })).stats;
  const cmp = compareToBaseline(b, a);
  const f0row = cmp.find((c) => c.key === 'medianF0');
  check('6 Hz 不算显著', f0row.significant === false, `delta=${f0row.delta}Hz, MDC=${MDC.medianF0}`);
}

console.log('\n[7] MDC：明显变化要算');
{
  const a = summarize(makeFrames({ seconds: 4, hz: 200 })).stats;
  const b = summarize(makeFrames({ seconds: 4, hz: 240 })).stats;
  const cmp = compareToBaseline(b, a);
  const f0row = cmp.find((c) => c.key === 'medianF0');
  check('40 Hz 算显著', f0row.significant === true, `delta=${f0row.delta}Hz`);
}

console.log('\n[8] 音域：窄 vs 宽');
{
  const narrow = summarize(makeFrames({ seconds: 4, hz: 220, jitterHz: 2 })).stats;
  const wide = summarize(makeFrames({ seconds: 4, hz: 220, jitterHz: 22 })).stats;
  check('宽的那次音域更大', wide.spanSt > narrow.spanSt,
    `${narrow.spanSt} → ${wide.spanSt} 半音`);
}

console.log('\n[9] 门控常量');
{
  check('有声时长下限 1 秒', GATE.minVoicedSec === 1.0);
  check('可信度下限 0.6', GATE.minClarity === 0.6);
}

console.log(`\n通过 ${pass} · 失败 ${fail}`);
console.log(fail === 0 ? 'METRICS_OK' : 'METRICS_FAILED');
process.exit(fail === 0 ? 0 : 1);
