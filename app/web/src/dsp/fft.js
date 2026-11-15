/* ===========================================================
   dsp/fft.js — 基 2 FFT 与频带能量

   只做一件事：给定一帧时域波形，算某个频带占多少能量。
   明亮度用它来比 1–4 kHz 与 100 Hz–1 kHz 的能量。

   迭代式 Cooley-Tukey，原地运算，表预先算好。
   =========================================================== */

/** 生成位反转表与旋转因子 */
function makePlan(n) {
  const bits = Math.log2(n);
  if (!Number.isInteger(bits)) throw new Error('FFT 长度必须是 2 的幂');

  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
    rev[i] = r;
  }

  const cos = new Float32Array(n / 2);
  const sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / n);
    sin[i] = Math.sin((-2 * Math.PI * i) / n);
  }
  return { n, rev, cos, sin };
}

const plans = new Map();
function planFor(n) {
  let p = plans.get(n);
  if (!p) { p = makePlan(n); plans.set(n, p); }
  return p;
}

/**
 * 原地 FFT。
 * @param {Float32Array} re 实部（长度 n）
 * @param {Float32Array} im 虚部（长度 n，可全 0）
 */
export function fft(re, im) {
  const n = re.length;
  const { rev, cos, sin } = planFor(n);

  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const c = cos[k];
        const s = sin[k];
        const a = i + j;
        const b = a + half;
        const tr = re[b] * c - im[b] * s;
        const ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

/* 复用缓冲，避免每帧分配 */
const scratch = new Map();
function buffers(n) {
  let b = scratch.get(n);
  if (!b) {
    b = { re: new Float32Array(n), im: new Float32Array(n), mag: new Float64Array(n / 2 + 1) };
    scratch.set(n, b);
  }
  return b;
}

/**
 * 一帧波形的功率谱（加汉宁窗）。
 * @returns {Float64Array} 长度 n/2+1 的功率谱
 */
export function powerSpectrum(samples, n) {
  const len = n || 1024;
  const { re, im, mag } = buffers(len);
  const N = Math.min(len, samples.length);

  // 加窗 + 去直流
  let mean = 0;
  for (let i = 0; i < N; i++) mean += samples[i];
  mean /= Math.max(1, N);

  for (let i = 0; i < len; i++) {
    const v = i < N ? samples[i] - mean : 0;
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1));   // Hann
    re[i] = v * w;
    im[i] = 0;
  }

  fft(re, im);

  const half = len / 2;
  for (let k = 0; k <= half; k++) {
    mag[k] = re[k] * re[k] + im[k] * im[k];
  }
  return mag;
}

/**
 * 频带能量比：hi 段总能量 / lo 段总能量，转 dB。
 * 明亮度就用它。
 */
export function bandRatioDb(spec, n, sampleRate, loHz, hiHz) {
  const binHz = sampleRate / n;
  let lo = 0;
  let hi = 0;
  for (let k = 1; k <= n / 2; k++) {
    const f = k * binHz;
    if (f < loHz || f >= hiHz) continue;
    if (f < 1000) lo += spec[k];
    else hi += spec[k];
  }
  if (lo <= 0) return null;
  return 10 * Math.log10((hi + 1e-20) / (lo + 1e-20));
}
