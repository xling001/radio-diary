/* ===========================================================
   dsp/spectralVoice.js — 谐波谱类指标、咽腔挤压 (Twang) 与喉部紧绷/公鸭音检测
   
   核心指标：
   - H1–H2: 第一谐波幅度 − 第二谐波幅度（dB）。
     随声门开商（Open Quotient）增大而升高：
     * H1 - H2 < -1.2 dB: 紧喉发音 / 夹嗓子（Pressed Voice，声带过度硬闭合撞击）
     * H1 - H2 ∈ [-1.2, 4.5] dB: 正常舒展女性化发音（Relaxed Modal）
     * H1 - H2 > 4.5 dB: 气声（Breathy）
   
   - Twang / 咽腔挤压比 (Pharyngeal Strain Index):
     2.2 kHz ~ 4.2 kHz (喉咽紧缩共鸣带) 与 400 Hz ~ 1500 Hz (前口腔主要元音区) 的能量比。
     * Twang < 0 dB: 正常宽敞通透
     * Twang ∈ [0, 2.0] dB: 略带共鸣集中
     * Twang > 2.0 dB 且 F0 > 195 Hz: 提喉公鸭音 / 太监音（Raised Larynx Duck Voice）
   =========================================================== */

import { fft } from './fft.js';
import { Yin } from './pitch.js';

const FRAME_SEC = 0.04; // 40ms 窗
const HOP_SEC = 0.02;   // 20ms 移

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function median(xs) {
  if (!xs || !xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * 计算完整录音的谐波谱开商、咽腔挤压度与喉部发紧状态
 *
 * @param {Float32Array} pcm
 * @param {number} sampleRate
 * @param {object} [opts]
 * @param {number[]} [opts.vowelF1s] 本次录音里各元音类的 F1（Hz）。
 *   给定后会排除「第一/第二谐波落在 F1 上」的帧——那些帧的 H1−H2 量的是共振峰，
 *   不是声门开商。依据：同一合成声门源只改 F1，H1−H2 会摆动 19.6 dB，
 *   足以让判定在「夹紧」与「舒展」之间翻面（docs/14）。
 * @returns {{ h1h2Db: number|null, h1_h2_db: number|null, twangDb: number|null, status: string, isPressed: boolean, isDuckVoice: boolean, advice: string }}
 */
export function computeSpectralVoice(pcm, sampleRate, opts = {}) {
  if (!pcm || pcm.length < 2048) {
    return {
      measured: false,
      h1h2Db: null,
      h1_h2_db: null,
      twangDb: null,
      harmonicsDb: null,
      harmonicsRelDb: null,
      h1h5Source: null,
      h1h5Db: null,
      spectralTiltDbOct: null,
      status: '未测出',
      isPressed: false,
      isDuckVoice: false,
      advice: '录音时间稍短',
    };
  }

  const vowelF1s = Array.isArray(opts.vowelF1s) ? opts.vowelF1s.filter((v) => Number.isFinite(v) && v > 0) : [];
  const F1_GUARD_HZ = 120; // 距离分桶实测标定：<100Hz 重污染，100~120Hz 仍漂移，>120Hz 与 150~200Hz 段一致
  let skippedByFormant = 0;
  let halvedFrames = 0;
  let framesVoiced = 0;

  // 复用主分析链的音高轨：spectralVoice 原来会**再跑一遍 YIN**，
  // 这是 120 秒录音里最大的一笔开销（实测 3.8 s / 总 5.1 s，占 75%）。
  // 主链（main.js 逐帧循环）已经算过 F0，时间戳 25 ms 一帧，直接按时间取最近帧即可。
  let f0Track = null;
  let f0Ptr = 0;
  if (Array.isArray(opts.frames) && opts.frames.length) {
    const t = [];
    const hz = [];
    for (const f of opts.frames) {
      t.push(f.t);
      hz.push(f.hz != null && (f.clarity == null || f.clarity >= 0.58) ? f.hz : null);
    }
    f0Track = { t, hz };
  }

  // 窗长下限 2048：16 kHz 输入下 0.04*fs = 640 小于 YIN 需要的窗长，
  // 会导致所有帧取不到 F0 而整段失效（曾表现为恒回 null，再被界面读成「舒展柔和」）
  const win = Math.max(2048, Math.round(FRAME_SEC * sampleRate));
  const hop = Math.max(256, Math.round(HOP_SEC * sampleRate));
  const n = nextPow2(win);
  const half = n >> 1;
  const binHz = sampleRate / n;

  const hann = new Float32Array(win);
  for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1));

  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const mag = new Float32Array(half);

  const yin = new Yin({ sampleRate, minHz: 75, maxHz: 550, threshold: 0.15, windowSize: 1024 });
  const h1h2List = [];
  const twangList = [];
  const f0List = [];
  const hCleanCols = [[], [], [], [], []];
  const hVoicedCols = [[], [], [], [], []];

  const bLow1 = Math.max(1, Math.floor(400 / binHz));
  const bLow2 = Math.min(half - 1, Math.ceil(1500 / binHz));
  const bHi1 = Math.max(1, Math.floor(2200 / binHz));
  const bHi2 = Math.min(half - 1, Math.ceil(4200 / binHz));

  for (let start = 0; start + win <= pcm.length; start += hop) {
    let sum = 0;
    for (let i = 0; i < win; i++) {
      const s = pcm[start + i];
      sum += s * s;
    }
    const rms = Math.sqrt(sum / win);
    const db = 20 * Math.log10(rms + 1e-10);
    if (db < -42) continue; // 静音/底噪跳过

    const frame = pcm.subarray(start, start + win);
    let f0 = null;
    if (f0Track) {
      const tc = (start + win / 2) / sampleRate;
      while (f0Ptr + 1 < f0Track.t.length && f0Track.t[f0Ptr + 1] <= tc) f0Ptr += 1;
      const hz = f0Track.hz[f0Ptr];
      if (hz == null) continue;
      f0 = hz;
    } else {
      const pitch = yin.detect(frame);
      if (!pitch || pitch.clarity < 0.62 || !pitch.hz) continue;
      f0 = pitch.hz;
    }
    f0List.push(f0);
    framesVoiced += 1;

    // 共振峰污染守卫：若第一或第二谐波压在某个元音的 F1 上，
    // 这一帧的「H1−H2」其实在量共振峰的增益差，不是声门开商。
    // 典型场景：/i/ 的 F1≈400 Hz，唱到 200 Hz 时 H2 正好落在 F1 —— 这样的帧一律不计入。
    let formantContaminated = false;
    for (let vi = 0; vi < vowelF1s.length; vi++) {
      const f1 = vowelF1s[vi];
      if (Math.abs(f0 - f1) < F1_GUARD_HZ || Math.abs(2 * f0 - f1) < F1_GUARD_HZ) {
        formantContaminated = true;
        break;
      }
    }

    // FFT
    for (let i = 0; i < n; i++) {
      re[i] = i < win ? frame[i] * hann[i] : 0;
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < half; b++) mag[b] = Math.hypot(re[b], im[b]);

    // 倍频 / 缺失基频检查（照 Koenami 的做法）
    //
    // 若奇次谐波平均值比偶次高出 10 dB 以上，说明本帧的「第一谐波」其实是个缺失的次谐波 ——
    // 真实能量落在第 2、3 谐波上。此时 H1−H2 量的不是声门开商。
    // 实测依据：用户两段真人录音（男声「啊」「衣」）里 H1 都明显偏弱，
    // 能量集中在 k=2、3；而 Koenami 报告正常发声只有约 3.3% 的帧属于这种情况。
    let harmonicDB = null;
    let halved = false;
    {
      const binHz = sampleRate / n;
      const peakAt = (hz) => {
        const tol = Math.max(0.06 * hz, binHz * 1.5);
        const lo = Math.max(1, Math.floor((hz - tol) / binHz));
        const hi = Math.min(half - 1, Math.ceil((hz + tol) / binHz));
        let m = 0;
        for (let b = lo; b <= hi; b++) if (mag[b] > m) m = mag[b];
        return 20 * Math.log10(m + 1e-20);
      };
      const h = [1, 2, 3, 4, 5, 6].map((k) => peakAt(k * f0));
      const odd = (h[0] + h[2] + h[4]) / 3;
      const even = (h[1] + h[3] + h[5]) / 3;
      // 对齐 Koenami: np.mean(harmonics[1::2]) - np.mean(harmonics[0::2]) > 10
      // 偶数倍谐波（2, 4, 6）能量显著高于奇数倍谐波（1, 3, 5）10dB 以上时，
      // 说明测到的 F0 只是真实音高的一半（缺失奇数次基波），判定为基频折半/假声边缘（Pitch Halving）
      harmonicDB = even - odd;
      halved = harmonicDB > 10;
      if (halved) halvedFrames += 1;
      if (!halved && h.slice(0, 5).every((v) => Number.isFinite(v) && v > -180)) {
        for (let k = 0; k < 5; k++) {
          hVoicedCols[k].push(h[k]);
          if (!formantContaminated) hCleanCols[k].push(h[k]);
        }
      }
    }

    // 1. 搜索第一、第二谐波峰值 (在目标频率 ±0.35 f0 范围内寻峰)
    const peakNear = (freq) => {
      const lo = Math.max(1, Math.floor((freq - f0 * 0.35) / binHz));
      const hi = Math.min(half - 1, Math.ceil((freq + f0 * 0.35) / binHz));
      let maxM = 0;
      for (let b = lo; b <= hi; b++) {
        if (mag[b] > maxM) maxM = mag[b];
      }
      return maxM;
    };

    const a1 = peakNear(f0);
    const a2 = peakNear(2 * f0);

    if (a1 > 1e-5 && a2 > 1e-5) {
      const d12 = 20 * Math.log10(a1 / a2);
      // 倍频帧直接跳过：本帧的「H1」是缺失的次谐波，量出来的不是声门开商
      if (!halved) {
        if (formantContaminated) {
          skippedByFormant += 1;
        } else if (d12 > -16 && d12 < 16) {
          h1h2List.push(d12);
        }
      }
    }

    // 2. 咽腔挤压度 (Twang / Pharyngeal Strain)
    // 喉咽腔收缩会造成 2.2k-4.2k 共鸣带能量相对中低频异常放大
    let lowMidEnergy = 0;
    let twangEnergy = 0;
    for (let b = bLow1; b <= bLow2; b++) lowMidEnergy += mag[b] * mag[b];
    for (let b = bHi1; b <= bHi2; b++) twangEnergy += mag[b] * mag[b];

    if (lowMidEnergy > 1e-8 && twangEnergy > 1e-8) {
      const twangRatio = 10 * Math.log10(twangEnergy / lowMidEnergy);
      twangList.push(twangRatio);
    }
  }

  const h1h2Med = median(h1h2List);
  const f0Med = median(f0List);

  let h1h2Val = h1h2Med != null ? parseFloat(h1h2Med.toFixed(1)) : null;

  // Twang 极度依赖元音（/i/ +2.7dB, /a/ -21dB, /u/ -32dB）。
  // 遵循与 ΔF 相同的科学原则：仅在主导元音明确为「衣」(/i/) 时输出，
  // 非「衣」音置为 null，避免受唇形衰减误导
  const isVowelI = opts.vowelLabel === '衣' || opts.dominantVowel === 'i';
  const twangMed = isVowelI ? median(twangList) : null;
  const twangVal = twangMed != null ? parseFloat(twangMed.toFixed(1)) : null;

  const halvingPct = framesVoiced ? Number(((halvedFrames / framesVoiced) * 100).toFixed(1)) : null;

  // 提取 H1~H5 谐波中位数 dB、相对最强谐波差（不含像素高度常量）、帧池来源与频谱倾斜斜率（dB/oct）
  const h1h5Source = hCleanCols[0].length >= 3 ? 'clean' : (hVoicedCols[0].length >= 3 ? 'voiced' : null);
  const hSourceCols = h1h5Source === 'clean' ? hCleanCols : (h1h5Source === 'voiced' ? hVoicedCols : null);
  let harmonicsDb = null;
  let harmonicsRelDb = null;
  let h1h5Db = null;
  let spectralTiltDbOct = null;
  if (hSourceCols) {
    const hMed = hSourceCols.map((col) => median(col));
    if (hMed.every((v) => v != null && Number.isFinite(v))) {
      const peakRef = Math.max(...hMed);
      harmonicsDb = hMed.map((v) => Number(v.toFixed(1)));
      harmonicsRelDb = hMed.map((v) => Number((v - peakRef).toFixed(1)));
      h1h5Db = Number((hMed[0] - hMed[4]).toFixed(1));
      const xs = [0, 1, Math.log2(3), 2, Math.log2(5)];
      const xMean = xs.reduce((a, b) => a + b, 0) / 5;
      const yMean = hMed.reduce((a, b) => a + b, 0) / 5;
      let num = 0;
      let den = 0;
      for (let k = 0; k < 5; k++) {
        num += (xs[k] - xMean) * (hMed[k] - yMean);
        den += (xs[k] - xMean) * (xs[k] - xMean);
      }
      if (den > 1e-6) spectralTiltDbOct = Number((num / den).toFixed(1));
    }
  }
  // 阈值基于修正后真实分布标定（正常人声~0%，假声/拉薄边缘振动通常在 3%~10%）
  const isHalvingElevated = halvingPct != null && halvingPct >= 3.0;
  const isHalvingSevere = halvingPct != null && halvingPct >= 7.0;

  // 默认「不知道」，而不是「很好」。
  // 以前这里默认 status='舒展柔和'，于是「没算出来」被界面读成「状态良好」——
  // 这是本项目最不该有的一类错误：把缺证据说成有证据。
  let status = '未测出';
  let measured = false;
  let isPressed = false;
  let isDuckVoice = false;
  let advice = (h1h2Val == null && skippedByFormant > 0)
    ? 'F1 与 2f0 靠得太近，容易干扰二次谐波测算；想看发声轻重可平稳发 3 秒「啊」。'
    : '这次没测到足够的稳定浊音，可换个元音再试。';
  if (h1h2Val == null && skippedByFormant > 0) {
    status = '未测出 · F1与2f0过近';
  }

  // 综合参考状态：保持克制，说明可能原因，不作绝对化定性
  if (opts.noOralVowels && h1h2Val != null && h1h2Val > 12.0) {
    // 闭口哼鸣特征：未识别到张口元音（口唇辐射被鼻腔旁路取代），导致 H1 异常突出 (>12 dB)。
    // 此时 H1−H2 与开放元音不具备声学可比性，应拒出结论并清零 h1h2Val。
    measured = false;
    h1h2Val = null;
    isPressed = false;
    isDuckVoice = false;
    status = '闭口哼鸣（H1−H2 不适用）';
    advice = '未识别到张口元音，且 H1−H2 显著偏高（多见于闭口哼鸣）；此时口唇辐射被鼻腔旁路改写，H1−H2 暂不作轻重判断，请张口发元音或自然朗读再测。';
  } else if (isHalvingElevated && f0Med != null && f0Med > 195) {
    measured = true;
    isDuckVoice = true;
    isPressed = true;
    status = isHalvingSevere ? '高音 · 伴较多假声/边缘感' : '高音 · 伴轻度假声感';
    advice = '音高已进入较高区（' + Math.round(f0Med) + ' Hz），同时检出 ' + halvingPct + '% 的奇偶谐波不均，这可能表示声带处于拉薄或边缘发声状态，有时也会让 H1−H2 显得偏高。如果自己感觉喉咙有点紧或吃力，可先叹口气放松喉头再试。';
  } else if ((f0Med != null && f0Med > 195 && h1h2Val != null && h1h2Val < -2.5) ||
      (f0Med != null && f0Med > 220 && h1h2Val != null && h1h2Val < -0.8)) {
    measured = true;
    isDuckVoice = true;
    isPressed = true;
    status = '高音 · 闭合偏实';
    advice = '音高偏高且声门闭合偏实。如果觉得喉咙轻松、听感符合预期就没关系；如果感觉发紧或费力，可先歇会儿喝口温水再试。';
  } else if (h1h2Val != null) {
    measured = true;

    if (h1h2Val <= -0.4) {
      status = '闭合偏实 / 偏紧';
      isPressed = true;
      advice = 'H1−H2 偏负，可能表示声带闭合得比较实或用力稍多；如果自己感觉喉咙发紧，可以试着用半打哈欠或轻轻叹气来放松。';
      if (f0Med != null && f0Med < 160) {
        status = '闭合偏实（低音参考）';
        advice = '在低音区说话时 H1−H2 偏负很常见，不一定代表紧张；结合自己喉咙是否轻松来判断即可。';
      }
    } else if (h1h2Val <= 1.5) {
      status = '轻重适中';
      isPressed = false;
      advice = '数值落在轻重过渡区间（H1−H2 ' + h1h2Val + ' dB），通常对应比较平稳的闭合度；可结合自身是否省力来微调。';
    } else if (h1h2Val <= 5.0) {
      status = '柔和流动';
      isPressed = false;
      advice = '数值落在较柔和舒展的参考区间，可能表示声带接触较轻、气流比较顺畅。';
    } else {
      if (isHalvingElevated && f0Med != null && f0Med >= 175) {
        status = '高音 · 假声边缘倾向';
        isPressed = true;
        advice = 'H1−H2 偏高，同时检出 ' + halvingPct + '% 的假声/边缘特征，可能表示声带被拉薄而非单纯的气息放松，建议以自身是否省力和实际听感为准。';
      } else if (f0Med != null && f0Med < 145) {
        status = '轻柔带气声（低音参考）';
        isPressed = false;
        advice = '低音区伴随一定的气声或次谐波起伏，整体闭合偏轻柔。';
      } else {
        status = '轻柔偏气声';
        isPressed = false;
        advice = 'H1−H2 较高（' + h1h2Val + ' dB），可能表示声带闭合较轻、带一点气声；如果觉得声音偏虚，可以稍补一点均匀的气息。';
      }
    }
  }

  const h1h2SkipPct = framesVoiced > 0 && skippedByFormant > 0
    ? Math.round((skippedByFormant / framesVoiced) * 100)
    : 0;

  // 没测到 H1−H2，但原因是「谐波压在共振峰上」时，把触发率与原因说清楚
  if (!measured && skippedByFormant > 0) {
    const pctNote = h1h2SkipPct > 0 ? `本次 ${h1h2SkipPct}% 帧因 2f0 贴近 F1 被跳过，` : '';
    advice = `${pctNote}谐波能量受共振峰放大干扰，H1−H2 暂不作判断；可改发平稳「啊——」3 秒再试。`;
  }

  return {
    measured,
    h1h2Db: h1h2Val,
    h1_h2_db: h1h2Val, // 兼容性字段
    twangDb: twangVal,
    status,
    isPressed,
    isDuckVoice,
    advice,
    // Twang 只作参考：它的绝对值强依赖元音与设备，不能跨条件比较。
    // 这里标出它是在哪一类元音上测的，界面据此显示「参考」而不是给结论。
    twangVowel: isVowelI ? (opts.vowelLabel || '衣') : null,
    twangReferenceOnly: true,
    // 诊断用：说清楚「丢了多少帧、为什么丢」，不参与判定
    h1h2Frames: h1h2List.length,
    h1h2SkippedFormant: skippedByFormant,
    h1h2SkipPct,
    // 守卫是否真的生效。为 false 时说明本次没能拿到可靠的 F1（元音没分类出来），
    // 此时 H1−H2 是「没有保护」的读数，界面不能当结论用。
    h1h2GuardActive: vowelF1s.length > 0,
    // 倍频帧占比（吊嗓指标）。Koenami 标定：正常发声 ≤3.3%，吊嗓（falsetto）≥20%。
    pitchHalvingPct: halvingPct,
    harmonicsDb,
    harmonicsRelDb,
    h1h5Source,
    h1h5Db,
    spectralTiltDbOct,
    framesVoiced,
  };
}
