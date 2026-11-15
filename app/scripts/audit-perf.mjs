/**
 * audit-perf.mjs — 离线分析耗时（主线程同步执行）
 * 运行： node app/scripts/audit-perf.mjs
 */

import { summarizeFormants } from '../web/src/dsp/formants.js';
import { computeVoiceQuality } from '../web/src/dsp/voiceQuality.js';
import { computeSpectralVoice } from '../web/src/dsp/spectralVoice.js';
import { analyzeSibilance } from '../web/src/dsp/sibilance.js';

const FS = 48000;

function synth(f0, durSec, fs) {
  const n = Math.round(durSec * fs);
  const x = new Float32Array(n);
  // 简易谐波堆 + 噪声，够触发各模块的有效帧
  for (let i = 0; i < n; i++) {
    const t = i / fs;
    let v = 0;
    for (let h = 1; h <= 12; h++) v += Math.sin(2 * Math.PI * f0 * h * t) / h;
    x[i] = 0.15 * v + (Math.random() - 0.5) * 0.004;
  }
  return x;
}

const synthFrames = (durSec) => {
  const n = Math.round(durSec / 0.025);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ t: i * 0.025, hz: 210, clarity: 0.9, db: -20 });
  }
  return out;
};

const fmt = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms) + ' ms');

console.log('\n离线分析耗时（单核 Node，手机通常更慢 2–5 倍）\n');
console.log('  时长    spectralVoice   voiceQuality   sibilance   formants   合计');
console.log('  ' + '-'.repeat(72));

let totalAt120 = 0;
for (const dur of [10, 30, 60, 120]) {
  const pcm = synth(210, dur, FS);
  const frames = synthFrames(dur);

  let t0 = performance.now();
  computeSpectralVoice(pcm, FS);
  const tSpec = performance.now() - t0;

  t0 = performance.now();
  computeVoiceQuality(pcm, FS);
  const tVq = performance.now() - t0;

  t0 = performance.now();
  analyzeSibilance(pcm, FS);
  const tSib = performance.now() - t0;

  t0 = performance.now();
  summarizeFormants(pcm, FS, frames);
  const tFm = performance.now() - t0;

  const sum = tSpec + tVq + tSib + tFm;
  if (dur === 120) totalAt120 = sum;

  console.log(
    `  ${String(dur + 's').padEnd(6)} ${fmt(tSpec).padStart(9)}  ${fmt(tVq).padStart(12)}  ${fmt(tSib).padStart(10)}  ${fmt(tFm).padStart(9)}  ${fmt(sum).padStart(8)}`,
  );
}

console.log('\n结论参考：');
console.log(`  120 秒录音在桌面端约 ${fmt(totalAt120)}；手机端按 2–5 倍估算 → ${fmt(totalAt120 * 2)} ~ ${fmt(totalAt120 * 5)}`);
console.log('  生产环境已由 Web Worker (analysisWorker) 异步执行，不阻塞主线程与 UI 交互。\n');
