/* ===========================================================
   dsp/pitch.js — 音高检测（YIN）

   算法出处：de Cheveigné & Kawahara (2002),
   "YIN, a fundamental frequency estimator for speech and music",
   J. Acoust. Soc. Am. 111(4), 1917–1930.

   实现参考了 simple-voice-tools-for-trans（MIT）的工程组织方式：
   差分函数 → 累积均值归一化（CMND）→ 阈值取谷 → 抛物线插值，
   以及"复用缓冲区，稳态零分配"的做法。
   我们改的地方：固定 16 kHz 工作采样率、窗口/阈值可调、
   输出带 clarity 供门控使用。

   本文件只做数学，不碰 DOM、不碰 Web Audio。
   =========================================================== */

/** 目标工作采样率。16 kHz 足够覆盖 0–8 kHz，且把 YIN 的运算量降到可实时。 */
export const WORK_RATE = 16000;

/**
 * 降采样到 16 kHz。
 * 先用一个简单的三点滑动平均做抗混叠（对 <600 Hz 的基频足够），
 * 再按整数倍抽取。不是高保真重采样器——测音高不需要。
 */
export function downsample(input, fromRate, toRate = WORK_RATE) {
  if (fromRate === toRate) return input.slice();

  const ratio = fromRate / toRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);

  if (Number.isInteger(ratio)) {
    const step = ratio;
    for (let i = 0; i < outLen; i++) {
      let sum = 0;
      const base = i * step;
      for (let k = 0; k < step; k++) sum += input[base + k] || 0;
      out[i] = sum / step;
    }
  } else {
    // 非整数倍：线性插值（很少走到，AudioContext 一般是 48k 或 44.1k）
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      out[i] = (input[i0] || 0) * (1 - frac) + (input[i0 + 1] || 0) * frac;
    }
  }
  return out;
}

/**
 * YIN 检测器。
 * 每次 detect() 传入一段等长帧，返回 { hz, clarity } 或 null。
 */
export class Yin {
  /**
   * @param {object} o
   * @param {number} o.sampleRate 工作采样率（默认 16000）
   * @param {number} o.minHz      搜索下限（默认 65）
   * @param {number} o.maxHz      搜索上限（默认 600）
   * @param {number} o.threshold  CMND 阈值（默认 0.14）
   * @param {number} o.windowSize 分析窗长（默认 1024，即 64 ms）
   */
  constructor({
    sampleRate = WORK_RATE,
    minHz = 65,
    maxHz = 600,
    threshold = 0.14,
    windowSize = 1024,
  } = {}) {
    this.sampleRate = sampleRate;
    this.minHz = minHz;
    this.maxHz = maxHz;
    this.threshold = threshold;
    this.windowSize = windowSize;

    // τ 的范围：τ = fs / f
    this.tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
    this.tauMax = Math.min(windowSize - 1, Math.floor(sampleRate / minHz));

    // 复用缓冲：长度 = 窗长 + 最大 τ，差分函数要用到 x[i+τ]
    this.buf = new Float32Array(windowSize + this.tauMax + 1);
    this.diff = new Float32Array(this.tauMax + 1);
    this.cmnd = new Float32Array(this.tauMax + 1);
  }

  /**
   * 喂满差分函数所需的样本数。
   *
   * 差分函数要算到 d(τmax)，需要 x[i + τ] 一直到 i = W-1、τ = τmax，
   * 也就是 W + τmax 个样本。少给的部分在 detect() 里会走 `(frame[i] || 0)` 被当成
   * 0 填掉——这在差分函数里等价于「对长 τ（低音）额外惩罚」，
   * 结果是音高被系统性地推高（实测低音区偏高 1~1.5%）。
   * 所以调用方务必传够 needed 个样本。
   */
  get needed() {
    return this.windowSize + this.tauMax;
  }

  /**
   * @param {Float32Array} frame 至少 windowSize 长
   * @returns {{hz:number, clarity:number, cmnd:number}|null}
   */
  detect(frame) {
    const W = this.windowSize;
    if (!frame || frame.length < W) return null;

    // 1. 去直流 + 归一化幅度（YIN 对整体音量不敏感，归一化让噪声帧也稳定）
    const buf = this.buf;
    let mean = 0;
    for (let i = 0; i < W; i++) mean += frame[i];
    mean /= W;

    let peak = 0;
    for (let i = 0; i < W + this.tauMax; i++) {
      const v = (frame[i] || 0) - mean;
      buf[i] = v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    if (peak < 1e-5) return null;      // 基本是静音
    const g = 1 / peak;
    for (let i = 0; i < W + this.tauMax; i++) buf[i] *= g;

    // 2. 差分函数 d(τ)
    const diff = this.diff;
    const tMin = this.tauMin;
    const tMax = this.tauMax;
    for (let tau = tMin; tau <= tMax; tau++) {
      let sum = 0;
      for (let i = 0; i < W; i++) {
        const d = buf[i] - buf[i + tau];
        sum += d * d;
      }
      diff[tau] = sum;
    }

    // 3. 累积均值归一化 d'(τ)
    const cmnd = this.cmnd;
    let running = 0;
    for (let tau = tMin; tau <= tMax; tau++) {
      running += diff[tau];
      cmnd[tau] = running === 0 ? 1 : (diff[tau] * (tau - tMin + 1)) / running;
    }

    // 4. 取第一个低于阈值的局部极小
    let best = -1;
    for (let tau = tMin + 1; tau < tMax; tau++) {
      if (cmnd[tau] < this.threshold && cmnd[tau] <= cmnd[tau - 1] && cmnd[tau] <= cmnd[tau + 1]) {
        best = tau;
        break;
      }
    }
    // 没有低于阈值的：退一步，取全局最小（clarity 会很低，交给门控判断）
    if (best < 0) {
      let minV = Infinity;
      for (let tau = tMin + 1; tau < tMax; tau++) {
        if (cmnd[tau] < minV) { minV = cmnd[tau]; best = tau; }
      }
      if (best < 0) return null;
    }

    // 5. 抛物线插值细化 τ
    let tau = best;
    if (tau > tMin && tau < tMax) {
      const s0 = cmnd[tau - 1];
      const s1 = cmnd[tau];
      const s2 = cmnd[tau + 1];
      const denom = 2 * (2 * s1 - s2 - s0);
      if (Math.abs(denom) > 1e-12) tau = tau + (s2 - s0) / denom;
    }
    if (tau <= 0) return null;

    const hz = this.sampleRate / tau;
    if (hz < this.minHz || hz > this.maxHz) return null;

    return { hz, clarity: Math.max(0, Math.min(1, 1 - cmnd[best])), cmnd: cmnd[best] };
  }
}

/* --------------------------- 统计小工具 --------------------------- */

export function median(arr) {
  if (!arr.length) return null;
  const a = arr.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function quantile(arr, q) {
  if (!arr.length) return null;
  const a = arr.slice().sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

/** 半音转换：以 refHz 为 0 */
export const toSemitones = (hz, refHz) => 12 * Math.log2(hz / refHz);

/**
 * 音高轨迹清洗与抗噪平滑器
 *
 * 消除 4 类实机常见假浊音与噪点：
 * 1. 动态活跃电平门限：过滤背景底噪、轻微环境音；
 * 2. 首尾触屏防抖裁切：过滤开始/结束点击录制按钮时的机械震动脉冲（常见 73Hz 钝击或 300Hz 擦击）；
 * 3. 连续浊音门限：人声真声带发音必然持续 >= 50ms（2 帧），过滤段间孤立摩擦音与喷麦单帧；
 * 4. 音高突变保护与 3 帧中值滤波：平滑单帧八度跳变与 350~400Hz 假谐波尖刺。
 *
 * @param {Array<{t: number, hz: number|null, clarity: number, db: number}>} frames
 * @returns {Array<{t: number, hz: number|null, clarity: number, db: number}>}
 */
export function cleanPitchTrack(frames) {
  if (!frames || frames.length < 3) return frames || [];
  if (frames._cleaned) return frames;
  const n = frames.length;
  const t0 = frames[0].t || 0;
  const tEnd = frames[n - 1].t || 0;
  const dur = tEnd - t0;
  const refDbs = [];
  for (let i = 0; i < n; i++) {
    const relT = (frames[i]?.t || 0) - t0;
    if (dur <= 1.0 || (relT >= 0.18 && relT <= dur - 0.18)) {
      refDbs.push(frames[i] && Number.isFinite(frames[i].db) ? frames[i].db : -60);
    }
  }
  const sortedDbs = (refDbs.length ? refDbs : frames.map((f) => (f && Number.isFinite(f.db) ? f.db : -60)))
    .slice()
    .sort((a, b) => a - b);
  const p95 = sortedDbs[Math.floor(sortedDbs.length * 0.95)] ?? -30;
  // 动态能量门限：活跃语音电平下浮 26dB，底限 -48dBFS 兼容未开 AGC 的小增益手机麦
  const gateDb = Math.max(-48, p95 - 26);

  // 1. 电平、置信度与有效频率初筛
  const raw = frames.map((f) => {
    if (!f) return f;
    const valid = f.hz != null && f.hz >= 75 && f.hz <= 550 &&
      (f.clarity == null || f.clarity >= 0.56) &&
      (f.db == null || f.db >= gateDb);
    return { ...f, hz: valid ? f.hz : null };
  });

  // 2. 首尾触屏按键防抖（录音起步 0.15s 与收尾 0.20s 内排除非连续语音）
  if (dur > 0.6) {
    for (let i = 0; i < n; i++) {
      const relT = (frames[i].t || 0) - t0;
      if (relT < 0.15 || relT > dur - 0.20) {
        let streak = 0;
        for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) {
          if (raw[j] && raw[j].hz != null) streak++;
        }
        if (streak < 3) raw[i].hz = null;
      }
    }
  }

  // 3. 连续浊音门限（至少连续 2 帧有声，孤立 1 帧判伪）
  for (let i = 0; i < n; i++) {
    if (raw[i].hz != null) {
      const hasPrev = i > 0 && raw[i - 1].hz != null;
      const hasNext = i < n - 1 && raw[i + 1].hz != null;
      if (!hasPrev && !hasNext) raw[i].hz = null;
    }
  }

  // 4. 音高突变保护与 3 帧中值平滑（去除单帧野点与 400Hz 尖刺）
  const out = raw.map((f) => ({ ...f }));
  for (let i = 1; i < n - 1; i++) {
    if (out[i].hz != null && out[i - 1].hz != null && out[i + 1].hz != null) {
      const a = out[i - 1].hz;
      const b = out[i].hz;
      const c = out[i + 1].hz;
      const med = [a, b, c].sort((x, y) => x - y)[1];
      const stDiff = Math.abs(12 * Math.log2(b / med));
      // 若当前帧偏离前后中值超过 6 个半音，以中值平滑代替野点
      if (stDiff > 6) {
        out[i].hz = med;
      }
    }
  }

  out._cleaned = true;
  return out;
}

