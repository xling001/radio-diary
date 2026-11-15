/**
 * dsp/cpp.js — CPP（倒谱峰突出度, Cepstral Peak Prominence）
 *
 * 为什么需要：HNR 和 CPP 一起才说得清「声带在付多少代价」。
 * Huang et al. 2024（上海 15 TW / 20 顺男 / 20 顺女）实测：
 * 中文跨女的 **CPP 在所有条件下都是三组里最低的**，且 VHI-10 显著更高——
 * 也就是说疲劳不是概率问题，是正在发生。HNR 单看会漏掉这部分。
 *
 * 做法（与 Praat 的 cepstral peak prominence 同思路，简化版）：
 *   1. 加窗 → FFT → 取对数幅度谱（ln）
 *   2. 反 FFT 得到实倒谱（横轴是「倒频」queffrency，单位秒）
 *   3. 在对应 65–600 Hz 的倒频区间内找峰
 *   4. 在同一区间上拟合一条回归线，峰高出回归线的量就是"突出度"
 *   5. 换算成 dB：20·log10(e^prom) = 8.686 × prom
 *
 * 已知简化：没做倒谱平滑（Praat 的 CPPS 会先平滑），也没做逐帧自适应窗长。
 * 所以数值不能与 Praat 直接对拍，只能在同一套口径内横向比较（同设备、同人）。
 */

import { fft } from './fft.js';

/** 原地反 FFT（用共轭技巧复用正变换） */
function ifftInPlace(re, im) {
  const n = re.length;
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im);
  const inv = 1 / n;
  for (let i = 0; i < n; i++) {
    re[i] *= inv;
    im[i] = -im[i] * inv;
  }
}

/**
 * @param {Float32Array} pcm
 * @param {number} sampleRate
 * @param {object} [opts]
 * @returns {{ cppDb: number|null, frames: number }}
 */
export function computeCPP(pcm, sampleRate, opts = {}) {
  const win = opts.win || 2048;
  const hop = opts.hop || Math.round(0.02 * sampleRate);
  const minHz = opts.minHz || 65;
  const maxHz = opts.maxHz || 600;

  if (!pcm || pcm.length < win) return { cppDb: null, frames: 0 };

  const n = win;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const hann = new Float32Array(n);
  for (let i = 0; i < n; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));

  // 倒频范围：q = fs / f
  const qLo = Math.max(2, Math.floor(sampleRate / maxHz));
  const qHi = Math.min(Math.floor(n / 2) - 1, Math.ceil(sampleRate / minHz));
  if (qHi <= qLo + 4) return { cppDb: null, frames: 0 };

  const vals = [];

  for (let start = 0; start + n <= pcm.length; start += hop) {
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const v = pcm[start + i];
      energy += v * v;
      re[i] = v * hann[i];
      im[i] = 0;
    }
    const db = 20 * Math.log10(Math.sqrt(energy / n) + 1e-12);
    if (db < -50) continue; // 静音帧

    fft(re, im);
    for (let i = 0; i < n; i++) {
      const m = Math.hypot(re[i], im[i]) + 1e-12;
      re[i] = Math.log(m);
      im[i] = 0;
    }
    ifftInPlace(re, im);

    // 在倒频区间上做线性回归（最小二乘）
    let sx = 0, sy = 0, sxx = 0, sxy = 0, cnt = 0;
    for (let q = qLo; q <= qHi; q++) {
      const y = re[q];
      sx += q; sy += y; sxx += q * q; sxy += q * y; cnt += 1;
    }
    if (cnt < 8) continue;
    const den = cnt * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) continue;
    const slope = (cnt * sxy - sx * sy) / den;
    const inter = (sy - slope * sx) / cnt;

    let peak = -Infinity;
    let peakQ = -1;
    for (let q = qLo; q <= qHi; q++) {
      if (re[q] > peak) { peak = re[q]; peakQ = q; }
    }
    if (peakQ < 0) continue;

    // 突出度（ln 单位）→ dB
    const prominence = peak - (inter + slope * peakQ);
    vals.push(8.686 * prominence);
  }

  if (vals.length < 5) return { cppDb: null, frames: vals.length };

  // 对齐 simple-voice-tools 的 CPPS：先对逐帧序列做滑动平均，再取均值。
  // 不做平滑时，峰值容易被单帧噪声拉平——实测四段性质完全不同的录音
  //（纯气流 / 张开啊 / 半开啊 / 男声衣）全挤在 0.7–1.1 dB，区分不出来。
  const smoothFrames = 5;
  const half = smoothFrames >> 1;
  const smoothed = vals.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(vals.length, i + half + 1);
    let s = 0;
    for (let k = lo; k < hi; k++) s += vals[k];
    return s / (hi - lo);
  });
  const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
  return { cppDb: Number(mean.toFixed(1)), frames: vals.length };
}
