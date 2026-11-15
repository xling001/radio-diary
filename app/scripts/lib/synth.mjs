/**
 * lib/synth.mjs — 合成测试信号（已知真值），给审计台与回归测试共用
 *
 * 为什么要合成：真实录音没有 ground truth，无法判断「算法错了」还是「人没发对」。
 * 合成信号知道确切 f0 / jitter / 时长，所以能直接对账。
 */

export const FS = 48000;

const R = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));

/** 2 极点共振器（声道单极点近似） */
export function resonator(fs, F, BW) {
  const r = Math.exp((-Math.PI * BW) / fs);
  const a1 = 2 * r * Math.cos((2 * Math.PI * F) / fs);
  const a2 = -r * r;
  return {
    y1: 0,
    y2: 0,
    run(x) {
      const y = x + a1 * this.y1 + a2 * this.y2;
      this.y2 = this.y1;
      this.y1 = y;
      return y;
    },
  };
}

/**
 * 合成元音：声门脉冲串（升余弦）→ 声道共振峰级联 → 加一点底噪
 * 返回 { pcm, trueJitter, trueShimmer, trueF0 }
 * trueJitter / trueShimmer 由实际生成的周期与振幅序列精确算出，可与算法输出直接对账。
 */
export function genVowel({
  dur,
  f0,
  formants = [[700, 80], [1200, 90], [2600, 120], [3500, 150]],
  jitterPct = 0,
  shimmerPct = 0,
  noise = 0.002,
  gain = 0.18,
  fs = FS,
}) {
  const baseT = fs / f0;
  const periods = [];
  const amps = [];
  let total = 0;
  while (total < dur * fs) {
    const T = Math.max(2, Math.round(baseT * (1 + (jitterPct / 100) * (Math.random() * 2 - 1))));
    periods.push(T);
    amps.push(1 + (shimmerPct / 100) * (Math.random() * 2 - 1));
    total += T;
  }

  let dt = 0;
  let da = 0;
  for (let k = 1; k < periods.length; k++) {
    dt += Math.abs(periods[k] - periods[k - 1]);
    da += Math.abs(amps[k] - amps[k - 1]);
  }
  const tMean = periods.reduce((s, v) => s + v, 0) / periods.length;
  const aMean = amps.reduce((s, v) => s + v, 0) / amps.length;
  const trueJitter = (dt / (periods.length - 1) / tMean) * 100;
  const trueShimmer = (da / (periods.length - 1) / aMean) * 100;

  const src = new Float32Array(total);
  let pos = 0;
  for (let k = 0; k < periods.length; k++) {
    const T = periods[k];
    const a = amps[k];
    // Rosenberg 声门脉冲：开相上升 + 闭相回落 + 闭拢期静止。
    // 不要用 0.5*(1-cos(2πt/T))——那是一个周期的升余弦，傅里叶展开里只有一次谐波和直流，
    // 频谱上等价于一根纯正弦，会让我们对 H1-H2 / Twang 的一切测试失去意义。
    const Tp = Math.max(2, Math.round(0.4 * T));
    const Tn = Math.max(1, Math.round(0.16 * T));
    for (let i = 0; i < T && pos + i < total; i++) {
      let g = 0;
      if (i < Tp) g = 0.5 * (1 - Math.cos((Math.PI * i) / Tp));
      else if (i < Tp + Tn) g = Math.cos((Math.PI * (i - Tp)) / (2 * Tn));
      src[pos + i] += a * g;
    }
    pos += T;
  }

  const res = formants.map(([F, BW]) => resonator(fs, F, BW));
  const pcm = new Float32Array(total);
  let peak = 0;
  for (let i = 0; i < total; i++) {
    let v = src[i];
    for (const r of res) v = r.run(v);
    v += (Math.random() * 2 - 1) * noise;
    pcm[i] = v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  const g = gain / (peak || 1);
  for (let i = 0; i < total; i++) pcm[i] *= g;

  return { pcm, trueJitter, trueShimmer, trueF0: fs / tMean };
}

/** 合成长 /s/：5.5–8.5 kHz 带限噪声，近似咝音能量分布（峰值远高于 4 kHz） */
export function genS(dur, gain = 0.09, fs = FS) {
  const n = Math.round(dur * fs);
  const out = new Float32Array(n);
  const comps = [];
  for (let k = 0; k < 48; k++) {
    comps.push({
      f: 5500 + Math.random() * 3000,
      p: Math.random() * 2 * Math.PI,
      a: 0.5 + Math.random(),
    });
  }
  const norm = Math.sqrt(comps.reduce((s, c) => s + c.a * c.a, 0) / 2);
  for (let i = 0; i < n; i++) {
    const t = i / fs;
    let v = 0;
    for (const c of comps) v += c.a * Math.sin(2 * Math.PI * c.f * t + c.p);
    out[i] = (v / norm) * gain;
  }
  return out;
}

/** 底噪 */
export function genSil(dur, amp = 0.0015, fs = FS) {
  const n = Math.round(dur * fs);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (Math.random() * 2 - 1) * amp;
  return out;
}

export function concat(...bufs) {
  const total = bufs.reduce((s, b) => s + b.length, 0);
  const out = new Float32Array(total);
  let p = 0;
  for (const b of bufs) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

export function median(xs) {
  const a = xs.slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export { R };
