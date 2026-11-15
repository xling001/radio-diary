/* ===========================================================
   metrics/gating.js — 这次录音算不算数

   两件事分开：
   · 门控（gating）：这段录音能不能拿来下结论
   · MDC：和上一次比，差值算不算真的变了

   门控口径参考 Koenami 的判据（有声时长、稳定段、削波、可信帧占比），
   MDC 口径参考 simple-voice-tools-for-trans（MIT）的保守初值。
   =========================================================== */

import { median, quantile, toSemitones, cleanPitchTrack } from '../dsp/pitch.js';
import { summarizeFormants } from '../dsp/formants.js';
import { buildSegments, phonationTimes } from './segments.js';
import { computeCPP } from '../dsp/cpp.js';
import { analyzeToneAndHealth } from '../dsp/tone.js';
import { analyzeSibilance } from '../dsp/sibilance.js';
import { computeVoiceQuality, computeExtendedStats } from '../dsp/voiceQuality.js';
import { computeSpectralVoice } from '../dsp/spectralVoice.js';

/** 最小可检测变化：差值小于它就当作没变，不许显示成"进步/退步" */
/** 普通话单韵母的界面用名（Twang 参考读数会标注它是在哪个韵母上测的） */
const VOWEL_LABEL = {
  a: '啊',
  o: '喔',
  e: '饿',
  i: '衣',
  u: '乌',
  v: '迂',
};

export const MDC = {
  medianF0: 12,     // Hz
  p10: 10,
  p90: 12,
  span: 1.5,        // 半音
  hnr: 1.5,         // dB
  balance: 1.2,     // dB
  deltaF: 25,       // Hz
};

/** 门控阈值 */
export const GATE = {  minVoicedSec: 1.0,          // 有声时间至少要 1 秒
  minClarity: 0.6,            // 可信度低于此的帧不算有声
  minVoicedFraction: 0.15,    // 有声帧占活跃帧的比例
  silenceDb: -55,             // 绝对静音门
  activeOffset: 20,           // 活跃帧 = 比最大电平低 20 dB 以内
  clippingDb: -1.0,           // 峰值接近满幅
  minDurationSec: 1.5,
};

/**
 * 把逐帧结果汇总成统计。
 * @param {Array<{t:number,hz:number|null,clarity:number,db:number}>} frames
 * @param {Float32Array|null} rawAudio 可选的原始 PCM 样本 (用于共鸣计算)
 * @param {number} sampleRate 采样率
 * @param {'free'|'script'} mode 自由说 或 读素材
 * @param {number|null} floorF0 专属安全托底线
 */
/**
 * 音高轨迹修补：八度纠错 + 短间隙填补。
 *
 * 为什么需要：YIN 是**逐帧独立**判断，遇到嘎裂/气声就返回 null 或给出八度错误。
 * pYIN（SVT 用的）带连续性跟踪，所以它能保住那些帧。
 * 实测证据：同一段音频 SVT 的 p10 = 94 Hz，我们 = 125 Hz（音域 10.3 vs 5.5 半音）；
 * 而单纯放宽 clarity 到 0.35 会掉到 71.8 Hz —— 那是把八度错误放进来了。
 *
 * 所以分两步：先把明显偏离局部参考的帧判为不可信（而不是放宽门槛），
 * 再对短间隙做插值填补。
 */
function repairPitchTrack(frames, maxGapSec = 0.15) {
  const n = frames.length;
  if (n < 5) return frames;
  const W = 12;
  const ref = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const vals = [];
    for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) {
      if (frames[j].hz != null && frames[j].clarity >= 0.58) vals.push(Math.log2(frames[j].hz));
    }
    ref[i] = vals.length ? vals.sort((a, b) => a - b)[vals.length >> 1] : NaN;
  }
  const out = frames.map((f) => ({ ...f }));
  for (let i = 0; i < n; i++) {
    if (out[i].hz == null) continue;
    const r = ref[i];
    if (!Number.isFinite(r)) continue;
    let lg = Math.log2(out[i].hz);
    for (let k = -1; k <= 1; k++) {
      if (Math.abs(lg - (r + k)) < 0.12) { lg = r + k; break; }
    }
    if (Math.abs(lg - r) > 0.25) { out[i].hz = null; out[i].clarity = 0; continue; }
    out[i].hz = Math.pow(2, lg);
  }
  const hopSec = n > 1 ? frames[1].t - frames[0].t : 0.025;
  let i = 0;
  while (i < n) {
    if (out[i].hz != null) { i += 1; continue; }
    let j = i;
    while (j < n && out[j].hz == null) j += 1;
    if (i > 0 && j < n && (j - i) * hopSec <= maxGapSec) {
      const a = Math.log2(out[i - 1].hz);
      const b = Math.log2(out[j].hz);
      for (let k = i; k < j; k++) {
        out[k].hz = Math.pow(2, a + (b - a) * ((k - i + 1) / (j - i + 1)));
        out[k].clarity = 0.5;
      }
    }
    i = j;
  }
  return out;
}

export function summarize(frames, rawAudio = null, sampleRate = 48000, mode = 'free', floorF0 = null) {
  const reasons = [];
  if (!frames.length) {
    return { ok: false, reasons: ['没有采到任何声音'], stats: null };
  }

  // 先进行音高轨迹清洗与抗噪平滑（去除首尾按键碰麦震动、孤立摩擦音与单帧 400Hz 尖刺野点）
  const cleanFrames = cleanPitchTrack(frames);

  const durationSec = cleanFrames[cleanFrames.length - 1].t - cleanFrames[0].t;
  const dbs = cleanFrames.map((f) => f.db);
  const p95 = quantile(dbs, 0.95);
  const refDbs = durationSec > 1.0
    ? cleanFrames
        .filter((f) => {
          const relT = f.t - cleanFrames[0].t;
          return relT >= 0.18 && relT <= durationSec - 0.18;
        })
        .map((f) => f.db)
    : dbs;
  const speechRefDb = refDbs.length ? quantile(refDbs, 0.95) : p95;
  const activeThreshold = Math.max(-48, speechRefDb - 26);
  const silence = Math.max(GATE.silenceDb, speechRefDb - 35);
  const active = Math.max(silence, speechRefDb - GATE.activeOffset);

  const activeFrames = cleanFrames.filter((f) => f.db > active);
  const voicedFrames = cleanFrames.filter(
    (f) => f.hz != null && f.clarity >= GATE.minClarity && f.db >= activeThreshold,
  );

  const voicedSec = (voicedFrames.length * 25) / 1000;
  const voicedFraction = activeFrames.length
    ? frames.filter((f) => f.hz != null && f.clarity >= GATE.minClarity && f.db > active).length / activeFrames.length
    : 0;

  // ---- 门控 ----
  if (durationSec < GATE.minDurationSec) {
    reasons.push(`录音只有 ${durationSec.toFixed(1)} 秒，太短了`);
  }
  if (voicedSec < GATE.minVoicedSec) {
    reasons.push(`听得出音高的时间只有 ${voicedSec.toFixed(1)} 秒`);
  }
  if (voicedFraction < GATE.minVoicedFraction) {
    reasons.push(`大部分时间没在出声（有声占 ${Math.round(voicedFraction * 100)}%）`);
  }
  if (p95 >= -12) {
    reasons.push('声音离爆音太近，手机可能削波了');
  }
  if (p95 <= -45) {
    reasons.push('整体太小声，贴近麦克风再说一次');
  }

  const hzList = voicedFrames.map((f) => f.hz);

  // 稀疏浊音：显式拒绝出数，而不是给一个勉强能用的中位数。
  // 判据照 Koenami 的 `sparse = count < 10 or count < .1 * active`：
  // 太少的有声帧算出来的中位数描述的是噪声，不是你的声音。
  if (hzList.length < 10 || hzList.length < 0.1 * frames.length) {
    if (rawAudio && rawAudio.length > 2048 && p95 > -40) {
      const sibOnly = analyzeSibilance(rawAudio, sampleRate);
      if (sibOnly && sibOnly.centroidHz != null && sibOnly.frameCount >= 8 && (sibOnly.durationSec ?? 0) >= 0.15) {
        const segRes = buildSegments(cleanFrames);
        const ext = computeExtendedStats(cleanFrames);
        return {
          ok: false,
          reasons: ['本次以清擦音（丝 [s]）为主，无声带基频，以下重点呈现咝音重心测量结果'],
          stats: {
            algoVersion: '0.5.0',
            segments: segRes,
            mpt: phonationTimes(segRes),
            durationSec: Number(durationSec.toFixed(2)),
            voicedSec: 0,
            voicedFraction: 0,
            medianF0: null,
            p10: null,
            p90: null,
            p5: null,
            f0P95: null,
            bandSt: null,
            spanSt: null,
            formants: null,
            hnr: null,
            cpp: null,
            clarityHnr: null,
            balance: null,
            deltaF: null,
            lengthCm: null,
            avgF1: null,
            avgF2: null,
            avgF3: null,
            avgF4: null,
            vowelSamples: [],
            sibilance: sibOnly,
            jitter: null,
            droppedFrameRatio: null,
            shimmer: null,
            spectral: {
              measured: false,
              h1h2Db: null,
              h1_h2_db: null,
              twangDb: null,
              harmonicsDb: null,
              harmonicsRelDb: null,
              h1h5Source: null,
              status: '清擦音无基频',
              isPressed: false,
              isDuckVoice: false,
              advice: '本次录制以清擦音「丝 [s]」为主，声带不振动，因此无基频与 H1−H2 数据，重点观察咝音重心是否在 6.0 ~ 8.5 kHz 前聚焦区。',
            },
            spectralVoice: null,
            h1_h2: null,
            twangDb: null,
            ext,
            tone: null,
            levelDb: Number(p95.toFixed(1)),
            frameCount: frames.length,
            voicedCount: hzList.length,
          },
        };
      }
    }
    return {
      ok: false,
      reasons: [...reasons, '有效浊音太少，这次先不下结论（贴近麦克风，正常说一句再试）'],
      stats: null,
    };
  }

  const medianF0 = median(hzList);
  const p10 = quantile(hzList, 0.1);
  const p90 = quantile(hzList, 0.9);
  const spanSt = toSemitones(p90, p10);
  // f0 带：Chen et al. 2026（26 名普通话跨女 / 5 周）用第 5/95 百分位量化音域变化。
  // 百分位抗异常值，且能直接看出「下界有没有塌进嘎裂」。p10/p90 保留做兼容。
  const p5 = quantile(hzList, 0.05);
  const f0P95 = quantile(hzList, 0.95); // 注意：上面那个 p95 是响度百分位（dBFS），不是音高
  const bandSt = toSemitones(f0P95, p5);

  // 质感：由 YIN 的周期性推一个 HNR 近似值。
  // 归一化差分 d' ≈ 2(1-r)，clarity = 1-d' ⟹ r = (1+clarity)/2
  // HNR = 10·log10(r/(1-r)) = 10·log10((1+c)/(1-c))
  const clarityList = voicedFrames.map((f) => f.clarity).filter((v) => v > 0);
  const clarityMed = clarityList.length ? median(clarityList) : null;
  let hnr = null;
  if (clarityMed != null) {
    const c = Math.min(0.985, Math.max(0.02, clarityMed));
    hnr = 10 * Math.log10((1 + c) / (1 - c));
  }

  // 明亮度：1–4 kHz 相对 100 Hz–1 kHz 的能量（dB）
  const balList = voicedFrames.map((f) => f.balance).filter((v) => v != null);
  const balance = balList.length ? median(balList) : null;

  // 共鸣 ΔF 与等效声道长
  let deltaF = null;
  let lengthCm = null;
  let avgF1 = null;
  let avgF2 = null;
  let avgF3 = null;
  let avgF4 = null;
  let vowelSamples = [];
  let sibilance = null;
  let formantDetail = null;
  let vq = { jitterPct: null, shimmerPct: null, hnrDb: null };
  let cppDb = null;
  // 没有原始音频时的兜底：明确「未测出」，不再默认「舒展 / 状态平稳」
  let spectral = { measured: false, h1h2Db: null, h1_h2_db: null, twangDb: null, status: '未测出', isPressed: false, isDuckVoice: false, advice: '这次没有可用的音频数据' };

  if (rawAudio && rawAudio.length > 2048) {
    const fRes = summarizeFormants(rawAudio, sampleRate, cleanFrames);
    deltaF = fRes.deltaF;
    lengthCm = fRes.lengthCm;
    avgF1 = fRes.avgF1;
    avgF2 = fRes.avgF2;
    avgF3 = fRes.avgF3 ?? null;
    avgF4 = fRes.avgF4 ?? null;
    vowelSamples = fRes.vowelSamples || [];
    formantDetail = {
      deltaF: fRes.deltaF,
      lengthCm: fRes.lengthCm,
      deltaFSource: fRes.deltaFSource || null,
      deltaFOverall: fRes.deltaFOverall ?? null,
      dominant: fRes.dominant || null,
      byVowel: fRes.byVowel || {},
      iCheck: fRes.iCheck || null,
      formantCountMedian: fRes.formantCountMedian ?? null,
      validCount: fRes.validCount ?? 0,
    };

    sibilance = analyzeSibilance(rawAudio, sampleRate);
    vq = computeVoiceQuality(rawAudio, sampleRate);
    cppDb = computeCPP(rawAudio, sampleRate).cppDb;
    // 把主导元音类的 F1 传进去，让 spectralVoice 排除「谐波压在共振峰上」的帧。
    // 主导元音是什么就用它自己的 F1 来守卫，不得用少数杂音 /a/ 帧越权覆盖 /i/ 的低 F1 守卫。
    const vowelF1s = (formantDetail?.dominant && formantDetail.byVowel?.[formantDetail.dominant])
      ? [formantDetail.byVowel[formantDetail.dominant].f1].filter((v) => Number.isFinite(v) && v > 0)
      : [];
    const noOralVowels = !formantDetail?.dominant && Object.keys(formantDetail?.byVowel || {}).length === 0;
    spectral = computeSpectralVoice(rawAudio, sampleRate, {
      vowelF1s,
      vowelLabel: VOWEL_LABEL[formantDetail?.dominant] || null,
      dominantVowel: formantDetail?.dominant || null,
      noOralVowels,
      frames: cleanFrames,
    });
  }

  // 中文声调与嘎裂巡航分析 (传入 spectral 进行高音区挤卡与提喉公鸭音防御)
  const tone = analyzeToneAndHealth(cleanFrames, medianF0, p10, floorF0, mode, spectral);
  const ext = computeExtendedStats(cleanFrames);

  // 只认一个 HNR 估计量：computeVoiceQuality 里基于归一化自相关峰的那个
  // （与 Praat to_harmonicity_cc 同一族：HNR = 10·log10(r/(1−r))）。
  // 旧代码在它为空时会退回去用一个「由 clarity 换算」的数——那是**第二个估计量**，
  // 口径与量纲都不同，混着显示等于自创标准（docs/research_notes/04：别自创）。
  // 现在为空就是空，界面显示「未测出」；clarity 换算值只留在 clarityHnr 里做诊断。
  const clarityHnr = hnr == null ? null : Number(hnr.toFixed(1));
  const finalHnr = vq.hnrDb != null ? vq.hnrDb : null;

  // 事件级切分：把「整段一个数」变成「一段一段的数」，MPT 与跟练都靠它
  const segRes = buildSegments(cleanFrames);

  const stats = {
    // 口径版本：任何会影响测量结果的改动都要改这个值。
    // 记录里存下它，跨版本比较时才能说「测量口径变了，这次不参与对比」。
    algoVersion: '0.5.0',
    segments: segRes,
    // 维持呼吸两项：「啊」走最长浊音段，「丝」走最长纯气声段（绕开失效的高频门限）
    mpt: phonationTimes(segRes),
    durationSec: Number(durationSec.toFixed(2)),
    voicedSec: Number(voicedSec.toFixed(2)),
    voicedFraction: Number(voicedFraction.toFixed(2)),
    medianF0: Number(medianF0.toFixed(1)),
    p10: Number(p10.toFixed(1)),
    p90: Number(p90.toFixed(1)),
    p5: p5 == null ? null : Number(p5.toFixed(1)),
    f0P95: f0P95 == null ? null : Number(f0P95.toFixed(1)),
    bandSt: bandSt == null ? null : Number(bandSt.toFixed(2)),
    spanSt: Number(spanSt.toFixed(2)),
    formants: formantDetail,
    hnr: finalHnr,
    cpp: cppDb,
    clarityHnr, // 仅诊断用：由 YIN 清晰度换算，语义与 HNR 不同，不要显示给用户
    balance: balance == null ? null : Number(balance.toFixed(1)),
    deltaF: deltaF == null ? null : Number(deltaF),
    lengthCm: lengthCm == null ? null : Number(lengthCm),
    avgF1: avgF1 == null ? null : Number(avgF1),
    avgF2: avgF2 == null ? null : Number(avgF2),
    avgF3: avgF3 == null ? null : Number(avgF3),
    avgF4: avgF4 == null ? null : Number(avgF4),
    vowelSamples,
    sibilance,
    jitter: vq.jitterPct,
    // 被丢帧比例：>0 时 jitter / shimmer 是下界，不是估计值
    droppedFrameRatio: vq.droppedFrameRatio ?? null,
    shimmer: vq.shimmerPct,
    spectral,
    spectralVoice: spectral,
    h1_h2: spectral.h1h2Db,
    twangDb: spectral.twangDb,
    ext,
    tone: tone,
    levelDb: Number(p95.toFixed(1)),
    frameCount: frames.length,
    voicedCount: hzList.length,
  };

  return { ok: reasons.length === 0, reasons, stats };
}

/**
 * 和基线比较。返回逐项变化与"是否真的变了"。
 * @param {object} now  summarize() 的 stats
 * @param {object} base 基线 stats
 */
export function compareToBaseline(now, base) {
  if (!now || !base) return null;
  const items = [
    ['medianF0', '音高', 'Hz'],
    ['p10', '音高下限', 'Hz'],
    ['p90', '音高上限', 'Hz'],
    ['spanSt', '音高跨度', '半音'],
    ['hnr', '质感', 'dB'],
    ['deltaF', '共鸣 ΔF', 'Hz'],
  ];

  return items.map(([key, label, unit]) => {
    const a = now[key];
    const b = base[key];
    // 任一侧缺失就不做差：以前 null - 12 = -12 会冒充「比上次低了 12」。
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
      return { key, label, unit, now: a ?? null, base: b ?? null, delta: null, significant: false, available: false };
    }
    // 跨版本口径保护：0.3.0 起共鸣 ΔF 撤销 /v/ 兜底，与 0.2.x 历史记录不可直接相减
    if (key === 'deltaF' && now.algoVersion !== base.algoVersion) {
      return { key, label, unit, now: a, base: b, delta: null, significant: false, available: false, versionChanged: true };
    }
    const delta = a - b;
    return {
      key,
      label,
      unit,
      now: a,
      base: b,
      delta: Number(delta.toFixed(1)),
      significant: Math.abs(delta) >= MDC[key],
      available: true,
    };
  });
}
