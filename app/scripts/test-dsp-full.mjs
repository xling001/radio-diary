/* ===========================================================
   test-dsp-full.mjs — 验证 LPC 共振峰与中文声调算法
   =========================================================== */

import { extractFormants, summarizeFormants } from '../web/src/dsp/formants.js';
import { hzToSemitone, normalizeSemitones, detectCreakFrames, analyzeToneAndHealth, estimateFloorF0FromGlissando } from '../web/src/dsp/tone.js';

const RATE = 48000;
const DUR = 0.5;

/** 合成一个带有指定共振峰 (F1, F2, F3) 的简易共鸣语音信号 */
function synthResonantVoice(f0, f1, f2, f3, dur = 0.5) {
  const n = Math.round(RATE * dur);
  const out = new Float32Array(n);
  // 简易脉冲源激励
  const period = Math.round(RATE / f0);
  for (let i = 0; i < n; i++) {
    const pulse = (i % period === 0) ? 1.0 : 0.0;
    // 叠加阻尼正弦共鸣
    out[i] = pulse * 0.3;
  }
  // 极简二阶 IIR 共振滤波器
  function applyResonance(samples, freq, bw) {
    const r = Math.exp(-Math.PI * bw / RATE);
    const theta = 2 * Math.PI * freq / RATE;
    const a1 = -2 * r * Math.cos(theta);
    const a2 = r * r;
    const res = new Float32Array(samples.length);
    let y1 = 0, y2 = 0;
    for (let i = 0; i < samples.length; i++) {
      const y0 = samples[i] - a1 * y1 - a2 * y2;
      res[i] = y0;
      y2 = y1; y1 = y0;
    }
    return res;
  }

  let sig = applyResonance(out, f1, 100);
  sig = applyResonance(sig, f2, 120);
  sig = applyResonance(sig, f3, 150);

  // 归一化
  let m = 0;
  for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(sig[i]));
  if (m > 0) {
    for (let i = 0; i < n; i++) sig[i] = (sig[i] / m) * 0.5;
  }
  return sig;
}

console.log('--- 1. 测试 LPC 共振峰与 ΔF 计算 ---');
// 模拟女声前元音 /i/：F1 ≈ 320 Hz, F2 ≈ 2600 Hz, F3 ≈ 3300 Hz
const sigI = synthResonantVoice(210, 320, 2600, 3300, DUR);
const resI = extractFormants(sigI.subarray(0, 2048), RATE);

console.log('模拟元音 /i/ 检出结果:');
console.log(`  F1: ${Math.round(resI.f1 || 0)} Hz (设定 320)`);
console.log(`  F2: ${Math.round(resI.f2 || 0)} Hz (设定 2600)`);
console.log(`  F3: ${Math.round(resI.f3 || 0)} Hz (设定 3300)`);
console.log(`  ΔF: ${Math.round(resI.deltaF || 0)} Hz`);
console.log(`  等效声道长: ${resI.lengthCm} cm`);

if (resI.f1 && Math.abs(resI.f1 - 320) < 80 && resI.f2 && Math.abs(resI.f2 - 2600) < 250) {
  console.log('  ✅ LPC 共振峰提取测试通过 (FORMANTS_OK)');
} else {
  console.warn('  ⚠️ 共振峰稍微偏离预期，检查极点窗口');
}

console.log('\n--- 2. 测试中文声调与嘎裂声 (Creaky Voice) 检测 ---');
// 构造一段包含正常声调下探和嘎裂塌陷的帧序列
const mockFrames = [];
// 前半段：平稳高平阴平 (210 Hz)
for (let i = 0; i < 20; i++) {
  mockFrames.push({ t: i * 0.025, hz: 210 + Math.sin(i) * 2, clarity: 0.9, db: -18 });
}
// 中间段：向下滑降 (210 -> 160 Hz)
for (let i = 20; i < 35; i++) {
  const hz = 210 - (i - 20) * 3.3;
  mockFrames.push({ t: i * 0.025, hz, clarity: 0.85, db: -20 });
}
// 尾端：跌入嘎裂区 (160 突然跳到 95 Hz，倍周期 + clarity 跌到 0.45 + db 骤跌)
for (let i = 35; i < 42; i++) {
  mockFrames.push({ t: i * 0.025, hz: 92, clarity: 0.48, db: -35 });
}
// 恢复静音
for (let i = 42; i < 50; i++) {
  mockFrames.push({ t: i * 0.025, hz: null, clarity: 0.1, db: -65 });
}

const creakResult = detectCreakFrames(mockFrames, 160);
const creakCount = creakResult.filter(Boolean).length;
console.log(`嘎裂帧检出数: ${creakCount} (预期在 35~41 帧检出)`);
if (creakCount >= 4) {
  console.log('  ✅ 嘎裂声 (Vocal Fry) 加权或门检测通过 (CREAK_OK)');
} else {
  console.error('  ❌ 嘎裂检测漏报');
}

const toneReport = analyzeToneAndHealth(mockFrames, 205, 155, 160, 'script');
console.log(`声调诊断总结: "${toneReport.summary}"`);
console.log(`嘎裂占比: ${(toneReport.creakRatio * 100).toFixed(1)}%`);
console.log(`底线守卫: ${toneReport.floorSafe ? '安全' : '有跌落'}`);

if (toneReport.ok && toneReport.creakRatio > 0.05) {
  console.log('  ✅ 中文声调与健康度综合分析通过 (TONE_OK)');
} else {
  console.error('  ❌ 声调分析未捕捉到异常');
}

// 测试高音公鸭嗓在声调中的正确识别
const mockDuckFrames = [];
for (let i = 0; i < 30; i++) mockDuckFrames.push({ t: i * 0.025, hz: 280, clarity: 0.95, db: -15 });
const duckToneReport = analyzeToneAndHealth(mockDuckFrames, 280, 270, 160, 'free', { isDuckVoice: true });
console.log(`高音公鸭音声调诊断: "${duckToneReport.summary}"`);
if ((duckToneReport.summary.includes('公鸭音') || duckToneReport.summary.includes('上咽腔的共鸣偏多')) && duckToneReport.issues.some(i => i.type === 'duck_voice')) {
  console.log('  ✅ 高音提喉公鸭音声调警报通过 (DUCK_TONE_OK)');
} else {
  console.error('  ❌ 高音公鸭音未能在声调中警报');
  process.exit(1);
}

console.log('\n--- 3. 测试专属安全托底线 (floorF0) 标定 ---');
const floorTestFrames = [
  { hz: 210, clarity: 0.9 },
  { hz: 190, clarity: 0.85 },
  { hz: 170, clarity: 0.82 },
  { hz: 150, clarity: 0.78 },
  { hz: 80, clarity: 0.42 }, // 150 -> 80 突跌
];
const estimatedFloor = estimateFloorF0FromGlissando(floorTestFrames);
console.log(`计算出的专属安全托底线: ${estimatedFloor} Hz (预期在 150 * 1.12 ≈ 168 Hz)`);
if (estimatedFloor >= 160 && estimatedFloor <= 175) {
  console.log('  ✅ 托底线计算准确 (FLOOR_OK)');
} else {
  console.warn('  ⚠️ 托底线稍有偏差:', estimatedFloor);
}

console.log('\nALL_DSP_TESTS_FINISHED');
