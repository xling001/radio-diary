/**
 * formants.js — LPC 共振峰提取与 ΔF 声道尺寸计算
 *
 * 信号处理流程：
 *   1. 预加重 (0.97)
 *   2. RBJ 双二阶低通抗混叠 (4.5 kHz) + 4x 降采样 (至 ~11 kHz)
 *   3. 汉明窗 + 自相关 (阶数 p ≈ 13)
 *   4. Levinson-Durbin 求解 LPC 预测系数
 *   5. Durand-Kerner 全复根迭代求解
 *   6. 极点频带与带宽筛选 (提取 F1 ~ F4)
 *   7. 奇数谐波归一化计算 ΔF 与等效声道长 L
 *
 * 参考自 simple-voice-tools (MIT) 与 Koenami (MIT)
 */

const DECIMATION = 4;
const C_SOUND = 35000; // 人体声道声速约 350 m/s = 35000 cm/s

/**
 * 普通话单韵母的共振峰参考锚点（Hz）。
 *
 * 类目遵循**普通话韵母系统**（不是自创的分类）：a / o / e / i / u / ü 六个单韵母。
 * 频带取自 Aoi 手册男女对照表（docs/research_notes/data/aoi_formants.csv），
 * 该表与 Huang et al. 2024（上海 15 TW / 20 顺男 / 20 顺女，测 F1–F4 全部四个）交叉核查过。
 *
 * 三点限定：
 * - 这是「理想参考带」，不是人群分布，**不能算百分位、不能用于评分**
 * - 普通话的 e 韵母（饿/哥/的/了）实际是 **[ɤ]**，对应 Aoi 表的 /e/ 那一档；
 *   而「诶」这个音在不同材料里写法不一，此处以 [ɤ] 为准
 * - **o 与 u 的 F1/F2 在本表里高度重叠**（F1 400–500 vs 350–500，F2 680–950 vs 700–1100），
 *   仅靠 F1/F2 无法稳定分开；这不是我们的简化，是这张表本身的性质。
 *   两个都试，取距离更近者，并在返回值里说明。
 * - 舌尖元音（资/知 的 -i[ɿ]/[ʅ]）与儿化 ɚ 本表没有覆盖，判不出就返回 null，不硬塞
 */
export const VOWEL_REFS = {
  a: { f1: [710, 750, 880, 950], f2: [1200, 1350, 1400, 1500], f3: [2400, 2600, 2700, 2900] },
  o: { f1: [400, 450, 450, 500], f2: [680, 850, 760, 950], f3: [2300, 2700, 2300, 2800] },
  e: { f1: [470, 520, 550, 650], f2: [1100, 1350, 1300, 1700], f3: [2400, 2600, 2800, 3100] },
  i: { f1: [300, 360, 350, 440], f2: [1750, 2150, 2300, 2750], f3: [2700, 3100, 3100, 3400] },
  u: { f1: [350, 440, 400, 490], f2: [700, 1000, 750, 1100], f3: [2300, 2500, 2600, 2800] },
  v: { f1: [320, 380, 350, 420], f2: [1600, 1800, 2000, 2300], f3: [2200, 2400, 2600, 2900] },
};

/** 频带重叠、无法靠 F1/F2 分开的组合（照实说明，不假装能分开） */
export const VOWEL_MERGE_NOTES = {
  o: '与 u 的 F1/F2 重叠，可能实为 u',
  u: '与 o 的 F1/F2 重叠，可能实为 o',
};

/**
 * 按 F1/F2 判普通话单韵母。
 *
 * 用「中位锚点 + 对数距离」做最近邻，并设距离上限 0.42 倍频程。
 * 超出上限的一律返回 null（不认识），宁可丢掉也不硬塞进某一类——
 * 这也是对「低频伪极点」的兜底：F1 估成 297 Hz 的帧不可能靠近任何一类。
 */
export function classifyVowel(f1, f2, opts = {}) {
  if (!f1 || !f2 || f1 <= 0 || f2 <= 0) return null;
  return classifyVowelDetail(f1, f2, opts).name;
}

/**
 * 同上的详细版：给出最近类、距离、以及是否与「o/u」这组重叠有关
 *
 * @param {object} [opts]
 * @param {boolean} [opts.male] 显式指定用参考表的男声档（true）或女声档（false）；
 *   默认（undefined）采用连续声道尺度轨迹归一化（消除 165 Hz 切档悬崖）。
 * @param {number|null} [opts.f3] 可选 F3（Hz），用于区分不圆唇 /i/ 与圆唇 /v/（ü）。
 */
export function classifyVowelDetail(f1, f2, opts = {}) {
  if (!f1 || !f2 || f1 <= 0 || f2 <= 0) return { name: null, distance: null, ambiguous: false, scale: null };

  const lp1 = Math.log2(f1);
  const lp2 = Math.log2(f2);
  const hasExplicitBand = typeof opts.male === 'boolean';
  const male = opts.male === true;

  let best = null;
  let bestD = Infinity;
  let bestT = 0;

  for (const [name, ref] of Object.entries(VOWEL_REFS)) {
    const m1 = (ref.f1[0] + ref.f1[1]) / 2;
    const m2 = (ref.f2[0] + ref.f2[1]) / 2;
    const w1 = (ref.f1[2] + ref.f1[3]) / 2;
    const w2 = (ref.f2[2] + ref.f2[3]) / 2;

    if (hasExplicitBand) {
      const c1 = male ? m1 : w1;
      const c2 = male ? m2 : w2;
      const d = Math.hypot(Math.log2(f1 / c1), Math.log2(f2 / c2));
      if (d < bestD) { bestD = d; best = name; bestT = male ? 0 : 1; }
    } else {
      // 连续声道尺度轨迹归一化：在 (log2 F1, log2 F2) 空间沿男->女参考线段投影
      const lm1 = Math.log2(m1), lm2 = Math.log2(m2);
      const lw1 = Math.log2(w1), lw2 = Math.log2(w2);
      const dv1 = lw1 - lm1, dv2 = lw2 - lm2;
      const lenSq = dv1 * dv1 + dv2 * dv2;
      let t = lenSq > 1e-6 ? ((lp1 - lm1) * dv1 + (lp2 - lm2) * dv2) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const p1 = lm1 + t * dv1;
      const p2 = lm2 + t * dv2;
      const d = Math.hypot(lp1 - p1, lp2 - p2);
      if (d < bestD) { bestD = d; best = name; bestT = t; }
    }
  }

  // 尺度无关比值兜底（F2 / F1）：针对少数声道偏长/偏短、略超出绝对锚点框的真实说话人
  let usedRatioFallback = false;
  if (bestD > 0.42 && !hasExplicitBand && f1 >= 220 && f1 <= 1150 && f2 >= 550 && f2 <= 3400 && f2 > f1 + 140) {
    const ratio = f2 / f1;
    let rBest = null;
    let rBestD = Infinity;
    for (const [name, ref] of Object.entries(VOWEL_REFS)) {
      if (name === 'i' && (f1 > 460 || f2 < 1700)) continue;
      const m1 = (ref.f1[0] + ref.f1[1]) / 2;
      const m2 = (ref.f2[0] + ref.f2[1]) / 2;
      const w1 = (ref.f1[2] + ref.f1[3]) / 2;
      const w2 = (ref.f2[2] + ref.f2[3]) / 2;
      const refRatio = Math.sqrt((m2 / m1) * (w2 / w1));
      const dRatio = Math.abs(Math.log2(ratio / refRatio));
      const dAbs = Math.hypot(
        Math.log2(f1 / Math.sqrt(m1 * w1)),
        Math.log2(f2 / Math.sqrt(m2 * w2))
      );
      if (dRatio <= 0.25 && dAbs <= 0.54 && dRatio < rBestD) {
        rBestD = dRatio;
        rBest = name;
      }
    }
    if (rBest) {
      best = rBest;
      bestD = rBestD;
      usedRatioFallback = true;
    }
  }

  if (!best || (!usedRatioFallback && bestD > 0.42)) {
    return { name: null, distance: bestD, ambiguous: false, scale: null };
  }

  // F3 解除圆唇歧义（跨女性生理声道前高元音保护，docs/65 §4.2）：
  // 圆唇动作（如发迂）急剧拉长前唇腔体使 F3 显著下降（通常 <= 2600 Hz），
  // 而不圆唇的「衣」其 F3 始终高耸在 >= 2700 Hz（通常 2800~3200 Hz）。
  // 当候选被初判为 /v/，但实测 F3 >= 2700 Hz 且 F2 >= 1800 Hz 时，物理铁证为不圆唇 /i/。
  let unroundedOverride = false;
  if (best === 'v' && opts.f3 && opts.f3 >= 2700 && f2 >= 1800) {
    best = 'i';
    unroundedOverride = true;
  }

  // /i/ 高元音物理护栏（防止 /e/ 高 F1 过渡帧或漏提 F3 后 F4/F5 错位帧污染 byVowel.i.deltaF）：
  // Aoi 与 Huang et al. (2024) 中女声 /i/ 上限分别为 F1<=440、F3<=3400；
  // 当连续归一化把 F1>460 或跳档后的 F3>3450 拉进 /i/ 时，拒收为 null 而不污染主 ΔF。
  if (!hasExplicitBand && best === 'i' && (f1 > 460 || (opts.f3 && opts.f3 > 3450))) {
    return { name: null, distance: bestD, ambiguous: false, scale: null };
  }

  const refBest = VOWEL_REFS[best];
  const m1Hz = (refBest.f1[0] + refBest.f1[1]) / 2;
  const m2Hz = (refBest.f2[0] + refBest.f2[1]) / 2;
  const scale = Number((0.5 * (f1 / m1Hz + f2 / m2Hz)).toFixed(3));

  return {
    name: best,
    distance: bestD,
    ambiguous: best === 'o' || best === 'u',
    unroundedOverride,
    usedRatioFallback,
    tNorm: Number(bestT.toFixed(3)),
    scale,
  };
}

/**
 * RBJ 双二阶低通滤波器
 */
function lowPassBiquad(samples, sampleRate, cutoff, out) {
  const w0 = (2 * Math.PI * cutoff) / sampleRate;
  const cosW0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.SQRT2); // Q = 0.707 (Butterworth)
  const b0 = (1 - cosW0) / 2;
  const b1 = 1 - cosW0;
  const b2 = (1 - cosW0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha;

  const nb0 = b0 / a0, nb1 = b1 / a0, nb2 = b2 / a0;
  const na1 = a1 / a0, na2 = a2 / a0;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
  }
}

/**
 * Levinson-Durbin 递推求解 LPC 系数
 */
function levinsonDurbin(r, order) {
  const a = new Float64Array(order + 1);
  if (r[0] <= 1e-9) return null;

  let e = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc -= a[j] * r[i - j];
    const k = acc / e;
    if (Math.abs(k) >= 1) return null; // 极点超出单位圆，放弃

    const half = (i - 1) >> 1;
    for (let j = 1; j <= half; j++) {
      const aj = a[j];
      const aim = a[i - j];
      a[j] = aj - k * aim;
      a[i - j] = aim - k * aj;
    }
    if (i % 2 === 0) {
      const j = i >> 1;
      a[j] -= k * a[j];
    }
    a[i] = k;
    e *= 1 - k * k;
  }
  return a.subarray(1, order + 1);
}

/**
 * Durand-Kerner (Weierstrass) 法求复多项式根
 * A(z) = 1 - a1*z - ... - aN*z^N
 */
function polyRoots(aCoeffs) {
  const N = aCoeffs.length;
  const re = new Float64Array(N);
  const im = new Float64Array(N);

  // 初始化根分布在复平面小圆环上
  const wRe = 0.4, wIm = 0.9;
  re[0] = 1; im[0] = 0;
  for (let i = 1; i < N; i++) {
    re[i] = re[i - 1] * wRe - im[i - 1] * wIm;
    im[i] = re[i - 1] * wIm + im[i - 1] * wRe;
  }

  const pRe = new Float64Array(N + 1);
  const pIm = new Float64Array(N + 1);
  pRe[0] = 1; pIm[0] = 0;
  for (let k = 1; k <= N; k++) {
    pRe[k] = -aCoeffs[k - 1];
    pIm[k] = 0;
  }

  for (let iter = 0; iter < 60; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < N; i++) {
      let hRe = pRe[0], hIm = pIm[0];
      for (let k = 1; k <= N; k++) {
        const nRe = hRe * re[i] - hIm * im[i] + pRe[k];
        const nIm = hRe * im[i] + hIm * re[i] + pIm[k];
        hRe = nRe; hIm = nIm;
      }

      let dRe = 1, dIm = 0;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const sRe = re[i] - re[j];
        const sIm = im[i] - im[j];
        const nRe = dRe * sRe - dIm * sIm;
        const nIm = dRe * sIm + dIm * sRe;
        dRe = nRe; dIm = nIm;
      }
      const denom = dRe * dRe + dIm * dIm;
      if (denom < 1e-12) continue;
      const qRe = (hRe * dRe + hIm * dIm) / denom;
      const qIm = (hIm * dRe - hRe * dIm) / denom;
      re[i] -= qRe; im[i] -= qIm;
      const delta = Math.hypot(qRe, qIm);
      if (delta > maxDelta) maxDelta = delta;
    }
    if (maxDelta < 1e-10) break;
  }
  return { re, im };
}

/**
 * 从单帧时域信号中提取 F1 ~ F4 共振峰
 * @param {Float32Array} samples 时域样本 (建议 2048 点 @ 44.1k/48k)
 * @param {number} sampleRate 物理采样率
 * @returns {{ f1: number|null, f2: number|null, f3: number|null, f4: number|null, deltaF: number|null, lengthCm: number|null }}
 */
export function extractFormants(samples, sampleRate) {
  if (samples.length < 512) return null;

  // 1. 预加重
  const pre = new Float32Array(samples.length);
  pre[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    pre[i] = samples[i] - 0.97 * samples[i - 1];
  }

  // 2. 抗混叠低通 + 自适应降采样 (目标 Nyquist 5.5k~8k Hz)
  const decimation = sampleRate >= 36000 ? 4 : (sampleRate >= 22000 ? 2 : 1);
  const fs2 = sampleRate / decimation;
  // 抗混叠上限对齐 Praat / Koenami：Praat 的 maximum_formant 默认 5000（男）/ 5500（女），
  // Koenami 的 acoustics.py 同时跑 5500 与 5000 两档。取 min(5200, fs2*0.42)。
  const lpCut = Math.min(5200, fs2 * 0.42);
  const filtered = new Float32Array(pre.length);
  lowPassBiquad(pre, sampleRate, lpCut, filtered);
  lowPassBiquad(filtered, sampleRate, lpCut, filtered);

  const n2 = Math.floor(filtered.length / decimation);
  if (n2 < 128) return null;
  const dec = new Float32Array(n2);
  for (let i = 0; i < n2; i++) dec[i] = filtered[i * decimation];

  // 3. 归一化 + 汉明窗
  let maxAbs = 0;
  for (let i = 0; i < n2; i++) maxAbs = Math.max(maxAbs, Math.abs(dec[i]));
  if (maxAbs < 1e-4) return null; // 静音帧直接返回

  const norm = 1 / maxAbs;
  const win = new Float64Array(n2);
  for (let i = 0; i < n2; i++) {
    win[i] = dec[i] * norm * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n2 - 1)));
  }

  // 4. 自相关与 LPC 阶数确定 (约 2 + fs2/1000 ≈ 12~18)
  const order = Math.min(Math.max(10, Math.round(fs2 / 1000) + 2), 18);
  const r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) {
    let sum = 0;
    for (let i = 0; i < n2 - k; i++) sum += win[i] * win[i + k];
    r[k] = sum;
  }

  // 5. LPC 系数求解
  const lpc = levinsonDurbin(r, order);
  if (!lpc) return null;

  // 6. 多项式求根
  const { re, im } = polyRoots(lpc);

  // 7. 极点筛选与共振峰候选收集
  // 上限按采样率推导，不写死：旧代码把 3400/4500/5200 定死，
  // 在 44.1k/16k 输入上与前缀滤波器实际通带对不上。
  const fMax = Math.min(5000, fs2 * 0.42);
  const candF = [];
  for (let i = 0; i < lpc.length; i++) {
    const mag = Math.hypot(re[i], im[i]);
    if (mag >= 1 || mag < 1e-5) continue; // 单位圆外不稳定，或过小
    const freq = (Math.atan2(im[i], re[i]) * fs2) / (2 * Math.PI);
    const bw = (-Math.log(mag) * fs2) / Math.PI;

    // 筛选合法频段 [150, fMax] 且带宽 < 700 Hz
    if (freq >= 150 && freq <= fMax && bw < 700) {
      candF.push(freq);
    }
  }
  candF.sort((a, b) => a - b);

  // 8. 挑取 F1, F2, F3, F4
  const capF2 = fMax * 0.75;
  const capF3 = fMax * 0.95;
  let f1 = null, f2 = null, f3 = null, f4 = null;
  let f1Idx = -1, f2Idx = -1, f3Idx = -1;

  for (let i = 0; i < candF.length; i++) {
    if (candF[i] >= 200 && candF[i] <= 1100) {
      f1 = candF[i];
      f1Idx = i;
      break;
    }
  }

  if (f1Idx >= 0) {
    const f2Lower = Math.max(f1 + 150, 700);
    for (let i = f1Idx + 1; i < candF.length; i++) {
      if (candF[i] >= f2Lower && candF[i] <= capF2) {
        f2 = candF[i];
        f2Idx = i;
        break;
      }
    }
  }

  if (f2Idx >= 0) {
    const f3Lower = f2 + 200;
    for (let i = f2Idx + 1; i < candF.length; i++) {
      if (candF[i] >= f3Lower && candF[i] <= capF3) {
        f3 = candF[i];
        f3Idx = i;
        break;
      }
    }
  }

  if (f3Idx >= 0) {
    const f4Lower = f3 + 200;
    for (let i = f3Idx + 1; i < candF.length; i++) {
      if (candF[i] >= f4Lower && candF[i] <= fMax) {
        f4 = candF[i];
        break;
      }
    }
  }

  // 9. 计算共鸣间距 ΔF 与等效声道长度 L
  //
  // 公式出处（docs/research_notes/03 §3）：
  //   均匀管闭-开模型下 F_n = (2n−1)·c/(4L)，
  //   所以 F_n / ((2n−1)/2) ≡ c/(2L) ≡ ΔF，各项都是同一个量的一致估计，
  //   取平均即可。因此「用几个共振峰」不影响量纲，只影响准确度——
  //   高阶共振峰受元音影响小，缺了 F3/F4 时估计会被元音特性带偏。
  // 所以这里额外输出 formantCount，让上层能区分「4 峰高可信」与「2 峰仅供参考」。
  const formantTerms = [];
  if (f1) formantTerms.push(f1 / 0.5);
  if (f2) formantTerms.push(f2 / 1.5);
  if (f3) formantTerms.push(f3 / 2.5);
  if (f4) formantTerms.push(f4 / 3.5);

  const formantCount = formantTerms.length;
  let deltaF = null;
  let lengthCm = null;

  if (formantCount >= 2) {
    deltaF = formantTerms.reduce((s, v) => s + v, 0) / formantCount;
  }

  if (deltaF && deltaF > 400 && deltaF < 2000) {
    lengthCm = C_SOUND / (2 * deltaF);
  } else {
    // 超出人类声道可能范围：当作没测出来，而不是报一个物理上不可能的数
    deltaF = null;
    lengthCm = null;
  }

  return { f1, f2, f3, f4, formantCount, deltaF, lengthCm };
}

/**
 * 对整段音频的有声帧进行共振峰与 ΔF 统计汇总
 *
 * **按元音分类再统计**，而不是把「衣」和「啊」的共振峰平均成一个数。
 * 依据（docs/research_notes/03）：
 *   - ΔF 强依赖元音：/i/ 干净（反推出 13.9 cm，与 Aoi 自述 14.1 cm 吻合），
 *     /a/ 可接受，/u/ /o/ 圆唇后元音系统性偏低（反推 22 cm，明显失真）
 *   - 自由说话里把不同元音的 F1/F2 混在一起求平均，得到的数**没有物理含义**
 * 所以对外的主指标改成「占比最大的那个元音类上的 ΔF」，并交代它是在哪个元音上测的。
 *
 * @param {Float32Array} audioData 原始整段音频
 * @param {number} sampleRate 物理采样率
 * @param {Array<{t: number, hz: number|null, clarity: number, db: number}>} frames
 */
export function summarizeFormants(audioData, sampleRate, frames) {
  const winSamples = 2048;
  const hopSamples = Math.round(sampleRate * 0.025); // 25ms 步长
  const allDF = [];
  const allF1 = [];
  const allF2 = [];
  const allF3 = [];
  const allF4 = [];
  const allScales = [];
  const vowelSamples = [];
  const buckets = {};
  let formantCountSum = 0;
  let formantCountN = 0;
  let unroundedOverrideCount = 0;

  const med = (a) => {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i];
    // 只在稳定有声且无爆音帧上提取
    if (!fr.hz || fr.clarity < 0.65 || fr.db < -45 || fr.db > -2) continue;

    const start = i * hopSamples;
    if (start + winSamples > audioData.length) break;

    const slice = audioData.subarray(start, start + winSamples);
    const est = extractFormants(slice, sampleRate);
    if (!est || est.deltaF == null) continue;

    formantCountSum += est.formantCount;
    formantCountN += 1;

    // 使用连续声道尺度归一化（不再按 165 Hz 硬切男/女档）+ F3 圆唇解歧
    const clsDetail = classifyVowelDetail(est.f1, est.f2, { f3: est.f3 });
    const cls = clsDetail.name;
    if (!cls) continue; // 认不出来的非元音（如闭口哼鸣、鼻音辅音、杂音）不参与任何元音共振峰与散点图统计
    if (clsDetail.unroundedOverride) unroundedOverrideCount += 1;

    allDF.push(est.deltaF);
    if (clsDetail.scale != null) allScales.push(clsDetail.scale);
    if (est.f1) allF1.push(est.f1);
    if (est.f2) allF2.push(est.f2);
    if (est.f3) allF3.push(est.f3);
    if (est.f4) allF4.push(est.f4);
    if (est.f1 && est.f2 && vowelSamples.length < 200) {
      vowelSamples.push({ f1: Math.round(est.f1), f2: Math.round(est.f2), vowel: cls });
    }

    const b = buckets[cls] || (buckets[cls] = { f1: [], f2: [], f3: [], f4: [], dF: [], dF4: [], scales: [] });
    if (est.f1) b.f1.push(est.f1);
    if (est.f2) b.f2.push(est.f2);
    if (est.f3) b.f3.push(est.f3);
    if (est.f4) b.f4.push(est.f4);
    if (clsDetail.scale != null) b.scales.push(clsDetail.scale);
    b.dF.push(est.deltaF);
    if (est.formantCount === 4) b.dF4.push(est.deltaF);
  }

  const MIN_CLASS = 5;
  const byVowel = {};
  let dominant = null;
  let dominantCount = 0;

  for (const [name, b] of Object.entries(buckets)) {
    if (b.dF.length < MIN_CLASS) continue;
    // 优先用「四个共振峰都在」的帧，估得更准；不够再退回全部
    const pool = b.dF4.length >= MIN_CLASS ? b.dF4 : b.dF;
    const dF = Math.round(med(pool));
    byVowel[name] = {
      count: b.dF.length,
      countFull: b.dF4.length,
      f1: b.f1.length ? Math.round(med(b.f1)) : null,
      f2: b.f2.length ? Math.round(med(b.f2)) : null,
      f3: b.f3.length ? Math.round(med(b.f3)) : null,
      f4: b.f4.length ? Math.round(med(b.f4)) : null,
      deltaF: dF,
      lengthCm: parseFloat((C_SOUND / (2 * dF)).toFixed(1)),
      scale: b.scales.length ? parseFloat(med(b.scales).toFixed(3)) : null,
    };
    if (b.dF.length > dominantCount) {
      dominantCount = b.dF.length;
      dominant = name;
    }
  }

  const overallDF = allDF.length >= MIN_CLASS ? Math.round(med(allDF)) : null;
  const vowelScale = allScales.length >= MIN_CLASS ? parseFloat(med(allScales).toFixed(3)) : null;
  const picked = dominant ? byVowel[dominant] : null;

  /* ΔF 只在 /i/（衣）或 /v/（迂）等前高元音上出数（docs/30 方案 A）。
     公式 ΔF = mean(F1/0.5, F2/1.5, F3/2.5, F4/3.5) 的前提是「一根粗细均匀的管子」。
     发「衣」的时候声道接近这个假设；发「呜」「喔」时嘴唇往前撅，等于给管子
     接了一截延长管，公式会把这段延长度算成「你声道变长了」——实测在 /u/ 上
     反推出 22 cm，超过任何成年男性的解剖上限（17–18 cm）。
     那说明是公式被喂错了输入，不是解剖结果。
     所以：拿不到足够的 /i/，就**不出数**，而不是拿别的元音凑一个看起来权威的错数。
     `deltaFOverall` 和 `byVowel` 仍然保留，供诊断与将来做分元音展示。 */
  const iClass = byVowel.i || null;
  const deltaF = iClass ? iClass.deltaF : null;
  const lengthCm = deltaF ? parseFloat((C_SOUND / (2 * deltaF)).toFixed(1)) : null;

  // 高元音过冲检查（Huang et al. 2024 的实证失败模式）：
  // 中文跨女 /i/ 的 F1 显著高于顺女、F2 显著低于顺女 —— 该开的没开够，不该开的开过头。
  // 这里只做「观察」：给两个布尔量，不做评分、不判定好坏。
  const iy = byVowel.i || null;
  const iRef = VOWEL_REFS.i;
  const iCheck = iy ? {
    f1: iy.f1,
    f2: iy.f2,
    f1AboveFemale: iy.f1 != null && iy.f1 > iRef.f1[3],
    f2BelowFemale: iy.f2 != null && iy.f2 < iRef.f2[2],
  } : null;

  return {
    // 主指标：只取 /i/（衣）那一类上的 ΔF。为空表示这次没有足够的「衣」——
    // 界面必须把「没测到」说出口，不能拿别的元音凑一个数顶上。
    deltaF,
    lengthCm,
    deltaFSource: iClass ? 'vowel:i' : null,
    // 诊断用：全元音的中位数与主导元音，不参与展示结论
    deltaFOverall: overallDF,
    dominantVowel: dominant,
    dominant: dominant,
    byVowel,
    vowelScale,
    unroundedOverrideCount,
    iCheck,
    iCount: iClass ? iClass.count : 0,

    // 兼容字段（旧界面与旧记录继续可读，但**不要**再拿它们做判定）
    avgF1: allF1.length ? Math.round(allF1.reduce((a, b) => a + b, 0) / allF1.length) : null,
    avgF2: allF2.length ? Math.round(allF2.reduce((a, b) => a + b, 0) / allF2.length) : null,
    avgF3: allF3.length ? Math.round(med(allF3)) : null,
    avgF4: allF4.length ? Math.round(med(allF4)) : null,
    vowelSamples,
    validCount: allDF.length,
    formantCountMedian: formantCountN ? Math.round(formantCountSum / formantCountN) : null,
  };
}
