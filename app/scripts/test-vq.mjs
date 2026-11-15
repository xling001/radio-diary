import { computeVoiceQuality, computeExtendedStats } from '../web/src/dsp/voiceQuality.js';
import { computeSpectralVoice } from '../web/src/dsp/spectralVoice.js';

console.log('--- 测试嗓音质量 (Jitter, Shimmer, HNR) 与谐波开商 (H1-H2) ---');

const fs = 48000;
const durSec = 1.0;
const n = Math.round(fs * durSec);
const pcm = new Float32Array(n);

// 模拟稳定的 200 Hz 正弦基频，带轻微第二谐波
for (let i = 0; i < n; i++) {
  const t = i / fs;
  // H1 = 0.3, H2 = 0.15 (H1-H2 > 0)
  pcm[i] = 0.3 * Math.sin(2 * Math.PI * 200 * t) + 0.15 * Math.sin(2 * Math.PI * 400 * t);
}

const vq = computeVoiceQuality(pcm, fs);
console.log('Voice Quality:', vq);

const spec = computeSpectralVoice(pcm, fs);
console.log('Spectral Voice:', spec);

if (vq.jitterPct === null || vq.shimmerPct === null || vq.hnrDb === null) {
  console.error('FAIL: vq 计算为空');
  process.exit(1);
}

if (spec.h1h2Db === null) {
  console.error('FAIL: spectral 计算为空');
  process.exit(1);
}

console.log('✅ 嗓音质量与谐波谱测试通过 (VOICE_QUALITY_OK)');

console.log('\n--- 测试 280 Hz 提喉公鸭音 (Twang / Duck Voice) 挤压检出 ---');
const pcmDuck = new Float32Array(n);
// 模拟 280 Hz 基频，伴随剧烈 2.8kHz ~ 3.5kHz 咽腔挤压共鸣 (Twang)
for (let i = 0; i < n; i++) {
  const t = i / fs;
  pcmDuck[i] = 0.2 * Math.sin(2 * Math.PI * 280 * t)
             + 0.25 * Math.sin(2 * Math.PI * 560 * t)
             + 0.4 * Math.sin(2 * Math.PI * 2800 * t);
}

const specDuck = computeSpectralVoice(pcmDuck, fs);
console.log('Duck Voice Result:', specDuck);

if (!specDuck.isDuckVoice) {
  console.error('FAIL: 未能检出公鸭音 / 咽腔挤卡');
  process.exit(1);
}
console.log('✅ 提喉公鸭音 (Twang / Duck Voice) 检出成功 (DUCK_VOICE_OK)');
