/* ===========================================================
   dsp/sibilance.js — 咝音 /s/ 频谱重心探针
   
   咝音（/s/、/ɕ/ 细音、/ʂ/ 翘舌音等清摩擦音）的频谱重心（Spectral Centroid）
   直接关联声道前部与牙槽共鸣的感知性别：
   - 传统较长声道 /s/ 重心通常在 4.5–5.5 kHz
   - 女性化前移与抬舌时，重心显著上移至 6.5–8.5 kHz
   
   纯离线无依赖算法：
   - 提取 4kHz 以上高频能量比 > 0.52 且高于底噪的摩擦音候选帧
   - 计算 1kHz 以上频带的一阶矩频谱重心
   =========================================================== */

import { fft } from './fft.js';

const WINDOW = 1024;
const HOP = 512;
const CENTROID_FMIN = 1000;
const CENTROID_FMAX = 13500; // 人声摩擦音上限，排除超高频采样/DAC底噪
const HF_BOUNDARY = 4000;
const HF_RATIO_MIN = 0.50;
const MIN_FRAMES = 3;

/**
 * 分析整段 PCM 音频的咝音特性
 * @param {Float32Array} pcm 原始音频
 * @param {number} sampleRate 物理采样率 (如 44100 或 48000)
 * @returns {{ centroidHz: number, p10Hz: number, p90Hz: number, frameCount: number, durationSec: number } | null}
 */
export function analyzeSibilance(pcm, sampleRate) {
  if (!pcm || pcm.length < WINDOW) return null;

  const binHz = sampleRate / WINDOW;
  const halfBins = WINDOW / 2;
  const centroidBinFrom = Math.max(1, Math.ceil(CENTROID_FMIN / binHz));
  const centroidBinTo = Math.min(halfBins, Math.floor(CENTROID_FMAX / binHz));
  const hfBinFrom = Math.ceil(HF_BOUNDARY / binHz);

  // 汉宁窗
  const win = new Float32Array(WINDOW);
  for (let i = 0; i < WINDOW; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WINDOW - 1));
  }

  const re = new Float32Array(WINDOW);
  const im = new Float32Array(WINDOW);
  const frames = [];

  for (let start = 0; start + WINDOW <= pcm.length; start += HOP) {
    let energy = 0;
    for (let i = 0; i < WINDOW; i++) {
      const s = pcm[start + i] * win[i];
      re[i] = s;
      im[i] = 0;
      energy += pcm[start + i] * pcm[start + i];
    }

    const rms = Math.sqrt(energy / WINDOW);
    const db = 20 * Math.log10(rms + 1e-12);

    fft(re, im);

    let sum = 0;
    let weighted = 0;
    let hf = 0;
    for (let b = centroidBinFrom; b < centroidBinTo; b++) {
      const mag = Math.hypot(re[b], im[b]);
      sum += mag;
      weighted += mag * (b * binHz);
      if (b >= hfBinFrom) hf += mag;
    }

    frames.push({
      db,
      centroid: sum > 1e-6 ? weighted / sum : 0,
      hfRatio: sum > 1e-6 ? hf / sum : 0,
    });
  }

  if (!frames.length) return null;

  // 响度门限：必须相对本次录音的动静范围来定，不能用「中位数 + 10 dB」。
  //   - 录一句正常话时，静音帧占多数，中位数≈底噪，+10dB 能挑出摩擦音 △ 可以
  //   - 录「维持呼吸」练一口气时，摩擦帧占多数，中位数≈摩擦音本身，+10dB 就一个都不剩 △ 不行
  // 所以改用两端夹：
  //   下界 = 比最安静的一撮（p05，近似底噪）高 10 dB —— 排除静音与底噪
  //   上界 = 离最响的帧（p95）不超过 30 dB —— 排除被更响的元音压掉的弱帧
  // 注意 p10 不行：静音不足 10% 时 p10 会落进摩擦音自己的一堆里。
  const dbs = frames.map((f) => f.db).sort((a, b) => a - b);
  const pct = (arr, q) => arr[Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * q)))];
  const p05Db = pct(dbs, 0.05);
  const p95Db = pct(dbs, 0.95);
  const levelThr = Math.max(p95Db - 30, p05Db + 10);

  const candidates = frames.map((f, i) => ({ ...f, i }));

  // 挑选咝音帧：高频占优 + 响度站得住
  let picked = candidates.filter((f) => f.hfRatio >= HF_RATIO_MIN && f.db >= levelThr);
  let contiguous = true;
  if (picked.length < MIN_FRAMES) {
    // 兜底：按响度取前若干帧。这些帧不一定相邻，因此不能声称「连续时长」。
    picked = candidates
      .filter((f) => f.hfRatio >= HF_RATIO_MIN)
      .sort((a, b) => b.db - a.db)
      .slice(0, MIN_FRAMES);
    contiguous = false;
  }

  const hopSec = HOP / sampleRate;

  /**
   * 最长连续帧游程。这是「一口气能撑多久」唯一正确的口径。
   *
   * 旧实现报的是 `帧数 × 帧移`，语义是「累计」；一旦录音里出现响度更高的元音，
   * 相对响度门限就会把摩擦帧全筛掉，退化成「按响度取前 3 帧」，
   * 于是恒定输出 3 × 512 / 48000 ≈ 0.032 s —— 一个看起来像测量值的假数。
   */
  function longestRunSec(list) {
    if (!list.length) return 0;
    const idx = list.map((f) => f.i).sort((a, b) => a - b);
    let best = 1;
    let cur = 1;
    for (let k = 1; k < idx.length; k++) {
      if (idx[k] === idx[k - 1] + 1) cur += 1;
      else cur = 1;
      if (cur > best) best = cur;
    }
    return best * hopSec;
  }

  const centroids = picked
    .map((f) => f.centroid)
    .filter((c) => c >= 2500 && c <= 12000)
    .sort((a, b) => a - b);

  if (centroids.length < MIN_FRAMES) return null;

  const medianCentroid = centroids[Math.floor(centroids.length / 2)];
  const p10 = centroids[Math.max(0, Math.floor(centroids.length * 0.1))];
  const p90 = centroids[Math.min(centroids.length - 1, Math.floor(centroids.length * 0.9))];

  return {
    centroidHz: Math.round(medianCentroid),
    p10Hz: Math.round(p10),
    p90Hz: Math.round(p90),
    frameCount: centroids.length,
    // 最长连续摩擦段（秒）。兜底取帧时无法定义连续性，给 null 而不是编一个数。
    durationSec: contiguous ? parseFloat(longestRunSec(picked).toFixed(2)) : null,
    // 全部摩擦帧的累计时间（秒），与 durationSec 语义不同，别混用。
    totalSec: parseFloat((picked.length * hopSec).toFixed(2)),
  };
}
