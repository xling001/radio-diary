/* ===========================================================
   test-pitch.mjs — 用合成信号验证 YIN 的准确度

   造一个带谐波 + 噪声的准周期信号，走一遍
   48k → 16k 降采样 → YIN，看还原出来的频率差多少音分。

   运行： node scripts/test-pitch.mjs
   =========================================================== */

import { Yin, downsample, WORK_RATE, median } from '../web/src/dsp/pitch.js';

const SRC_RATE = 48000;
const DUR = 1.0;

/** 造一个锯齿状带谐波的信号（基频 f0） */
function synth(f0, rate, dur, { harmonics = 8, noise = 0.01 } = {}) {
  const n = Math.round(rate * dur);
  const out = new Float32Array(n);
  // 随机相位，避免每次都一样
  const phases = Array.from({ length: harmonics }, () => Math.random() * Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v = 0;
    for (let h = 1; h <= harmonics; h++) {
      const amp = 1 / h;                       // 谐波递减，像人声
      if (f0 * h > rate / 2 - 100) break;      // 不超过奈奎斯特
      v += amp * Math.sin(2 * Math.PI * f0 * h * t + phases[h - 1]);
    }
    v += (Math.random() - 0.5) * 2 * noise;
    out[i] = v * 0.2;                          // 别削顶
  }
  return out;
}

function cents(a, b) {
  return 1200 * Math.log2(a / b);
}

const CASES = [82, 110, 147, 175, 196, 220, 262, 330, 392, 466];

console.log('基频(Hz)  检出中位(Hz)   误差(音分)   判定');
console.log('-----------------------------------------------');

let worst = 0;
for (const f0 of CASES) {
  const raw = synth(f0, SRC_RATE, DUR);
  const ds = downsample(raw, SRC_RATE, WORK_RATE);

  const W = 1024;
  const yin = new Yin({ sampleRate: WORK_RATE, windowSize: W });
  const found = [];

  for (let start = 0; start + W <= ds.length; start += 512) {
    const frame = ds.subarray(start, start + W);
    const r = yin.detect(frame);
    if (r && r.clarity > 0.5) found.push(r.hz);
  }

  if (!found.length) {
    console.log(`${String(f0).padEnd(10)} 没检出`);
    continue;
  }

  const mid = median(found);
  const err = cents(mid, f0);
  worst = Math.max(worst, Math.abs(err));
  const ok = Math.abs(err) < 25 ? 'OK' : '超差';
  console.log(
    `${String(f0).padEnd(10)} ${mid.toFixed(1).padStart(10)}   ` +
    `${err.toFixed(1).padStart(9)}   ${ok}  (n=${found.length})`,
  );
}

console.log('-----------------------------------------------');
console.log(`最大误差 ${worst.toFixed(1)} 音分`);
console.log(worst < 25 ? 'PITCH_OK' : 'PITCH_OUT_OF_TOLERANCE');

/* ---- 再来一个：静音输入不该乱报 ---- */
const silence = new Float32Array(SRC_RATE);
const dsSil = downsample(silence, SRC_RATE, WORK_RATE);
const yin2 = new Yin();
let falsePos = 0;
for (let s = 0; s + 1024 <= dsSil.length; s += 512) {
  if (yin2.detect(dsSil.subarray(s, s + 1024))) falsePos++;
}
console.log(`静音里的误报帧：${falsePos}`);
console.log(falsePos === 0 ? 'SILENCE_OK' : 'SILENCE_LEAK');
