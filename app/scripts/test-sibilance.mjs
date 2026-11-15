import { analyzeSibilance } from '../web/src/dsp/sibilance.js';

console.log('--- 测试咝音 /s/ 频谱重心探针 ---');

const fs = 48000;
const pcm = new Float32Array(fs * 2); // 2 秒音频

// 前 0.5 秒静音/环境底噪
for (let i = 0; i < fs * 0.5; i++) {
  pcm[i] = (Math.random() * 2 - 1) * 0.001;
}

// 0.5~1.0 秒模拟发“思”/“四”的清辅音摩擦段 (/s/，中心 7.2 kHz)
for (let i = Math.round(fs * 0.5); i < Math.round(fs * 1.0); i++) {
  const t = i / fs;
  pcm[i] = 0.22 * Math.sin(2 * Math.PI * 7200 * t);
}

// 1.0~2.0 秒回落为弱环境音
for (let i = Math.round(fs * 1.0); i < fs * 2; i++) {
  pcm[i] = (Math.random() * 2 - 1) * 0.002;
}

const stats = analyzeSibilance(pcm, fs);
console.log('咝音统计结果:', stats);

if (!stats || !stats.centroidHz) {
  console.error('FAIL: 未检出咝音');
  process.exit(1);
}

if (stats.centroidHz < 6800 || stats.centroidHz > 7600) {
  console.error(`FAIL: 重心偏离预期: ${stats.centroidHz}`);
  process.exit(1);
}

console.log(`✅ 咝音重心准确检出: ${stats.centroidHz} Hz (SIBILANCE_OK)`);
