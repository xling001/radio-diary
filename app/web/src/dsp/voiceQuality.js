/* ===========================================================
   dsp/voiceQuality.js — 嗓音质量指标（Jitter / Shimmer / HNR）与全局统计
   
   对齐临床常用嗓音病理学定义与 Praat 口径：
   - Jitter(local): 相邻基音周期长度波动率均值 × 100%（正常舒展约 0.3%~1.2%，>1.8% 提示紧绷或疲劳）
   - Shimmer(local): 相邻基音周期振幅波动率均值 × 100%（正常约 1.5%~4.5%）
   - HNR: 谐噪比（dB），由周期处归一化自相关峰值换算，正常 > 12 dB
   - 音高全指标：平均/中位基频、极值、P10/P90、基频标准差（半音）、男/过渡/女声区占比
   =========================================================== */

import { Yin, WORK_RATE } from './pitch.js';

const WIN_SEC = 0.128; // 128ms 分析窗
const HOP_SEC = 0.128; // 不重叠帧移
const JITTER_CAP = 5.0; // 离群异常上限
const SHIMMER_CAP = 15.0;

function mean(arr) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

/**
 * 在一帧内提取基音周期序列（正峰检测 + 抛物线插值细化）
 * @param {Float32Array} frame
 * @param {number} sampleRate
 * @param {number} f0
 */
function extractPeriods(frame, sampleRate, f0) {
  // P0-2：改由 F0 引导的脉冲追踪，不再用「高于 0.3·maxAbs 的正峰」逐个摘。
  // 旧做法对激励波形形状极度敏感：合成信号大量返回 null、真人录音被丢帧 46%。
  // 新做法用 F0 给出的周期 T 作为引导，每步只在 [0.85T, 1.15T] 内找最强的正峰，
  // 因此不依赖绝对阈值，也不怕弱峰。
  const n = frame.length;
  const T = sampleRate / f0;
  if (!Number.isFinite(T) || T < 2) return null;
  const minT = Math.max(2, Math.floor(T * 0.85));
  const maxT = Math.ceil(T * 1.15);

  let start = 0;
  let best = 0;
  for (let i = 1; i < Math.min(n - 1, Math.round(n * 0.35)); i++) {
    const a = Math.abs(frame[i]);
    if (a > best) { best = a; start = i; }
  }
  if (best < 1e-4) return null;

  const periods = [];
  const amps = [];
  let pos = start;
  while (pos < n - maxT - 1) {
    let lagBest = -1;
    let valBest = -Infinity;
    for (let lag = minT; lag <= maxT; lag++) {
      const idx = pos + lag;
      if (idx + 1 >= n) break;
      const v = frame[idx];
      if (v > 0 && v >= frame[idx - 1] && v >= frame[idx + 1] && v > valBest) {
        valBest = v;
        lagBest = lag;
      }
    }
    if (lagBest < 0) { pos += Math.max(2, Math.round(T)); continue; }
    // 抛物线细化：当峰顶落在两个采样点之间时，用三点拟合出顶点的真实位置与高度。
    // 不做这一步，周期只能取整数样本（量化误差约 1/T，例如 T=240 时是 0.4%），
    // 振幅也只能取整点采样值 —— 这两笔误差会原样进入 jitter / shimmer。
    // 实测未细化时比 Praat 高 0.8 / 1.4 个百分点，与量化误差的量级吻合。
    const idx = pos + lagBest;
    const y0 = frame[idx];
    const ym = frame[idx - 1];
    const yp = frame[idx + 1];
    const denom = ym - 2 * y0 + yp;
    let delta = 0;
    let refinedAmp = y0;
    if (Math.abs(denom) > 1e-12) {
      delta = (0.5 * (ym - yp)) / denom;
      if (delta > 0.5) delta = 0.5;
      if (delta < -0.5) delta = -0.5;
      refinedAmp = y0 - (0.125 * (ym - yp) * (ym - yp)) / denom;
    }
    periods.push(lagBest + delta);
    amps.push(refinedAmp);
    pos += lagBest;
  }
  return periods.length >= 3 ? { periods, amps } : null;
}
/**
 * 由归一化自相关峰值计算 HNR (dB)
 */
function hnrFromAcf(frame, sampleRate, f0) {
  const tau0 = Math.round(sampleRate / f0);
  const n = frame.length;
  let bestR = 0;

  for (let d = -5; d <= 5; d++) {
    const tau = tau0 + d;
    if (tau < 1 || tau >= n) continue;
    let corr = 0;
    let sum1 = 0;
    let tailEnergy = 0;
    for (let i = 0; i < n - tau; i++) {
      corr += frame[i] * frame[i + tau];
      sum1 += frame[i] * frame[i];
      tailEnergy += frame[i + tau] * frame[i + tau];
    }
    if (sum1 <= 0 || tailEnergy <= 0) continue;
    const r = corr / Math.sqrt(sum1 * tailEnergy);
    if (r > bestR) bestR = r;
  }

  if (bestR <= 0.05) return null;
  if (bestR >= 0.999) return 40;
  return 10 * Math.log10(bestR / (1 - bestR));
}

/**
 * 从完整录音 PCM 计算 Jitter, Shimmer, HNR
 * @param {Float32Array} pcm
 * @param {number} sampleRate
 * @returns {{ jitterPct: number|null, shimmerPct: number|null, hnrDb: number|null }}
 */
export function computeVoiceQuality(pcm, sampleRate, opts = {}) {
  if (!pcm || pcm.length < 2048) {
    return { jitterPct: null, shimmerPct: null, hnrDb: null };
  }

  // P0-3：窗长对齐 Praat `to_harmonicity_cc(periods_per_window = 4.5)`。
  // 旧实现固定 128 ms，对 140 Hz 的嗓音相当于 18 个周期——窗太长，音高在窗内的
  // 起伏被算成「周期性差」，HNR 被系统性压低。实测同一文件：我们 7.3 dB、SVT 11.8 dB。
  // 做法分两步：先用 40 ms 基窗取 F0，再按 4.5 个周期重新截取该帧做 HNR 与周期分析。
  // HNR 的分析窗长度（周期数）。Praat to_harmonicity_cc 用的是 4.5 periods/window，
  // 但那是 Praat 自己的窗与截断方式下的取值。我们这套实现（tau 只在 ±5 样本内搜索、
  // 不做抛物线细化）在 4.5 时给出 14.1 dB，偏高 2.3 dB。
  // 在同一段音频（67 s）上扫描后，8 个周期得到 11.8 dB，与 SVT/Praat 一致 → 定为默认。
  // 这是**对标定后的值**，不是 Praat 的原始参数，改动前必须重新对拍。
  const PERIODS = opts.periods ?? 8;
  const JIT_CAP = opts.jitterCap ?? 6.0;
  const SHIM_CAP = opts.shimmerCap ?? 18.0;
  const BASE = Math.max(1024, Math.round(0.04 * sampleRate));
  const hop = Math.max(1, Math.round(0.025 * sampleRate));
  // minHz 对齐 Praat to_harmonicity_cc(minimum_pitch=65) 与 Koenami 的 acoustics.py
  const yin = new Yin({ sampleRate, minHz: 65, maxHz: 550, threshold: 0.15, windowSize: 1024 });

  const jitters = [];
  const shimmers = [];
  const hnrs = [];
  let prevF0 = 0;
  // 记账：有多少帧因为超过上限被丢掉。
  // 丢掉时界面上的 jitter/shimmer 其实是**下界**而不是估计值——
  // 越用力、抖动越大、被丢的帧越多，剩下的好帧让结论看起来越干净（docs/16 E4）。
  // 不把这个比例返出来，外面就只能看到一个偏乐观的数。
  let periodFrames = 0;
  let droppedJitter = 0;
  let droppedShimmer = 0;
  let sumDt = 0;
  let sumDa = 0;
  let sumPeriod = 0;
  let sumAmp = 0;
  let sumIntervals = 0;
  let sumIntervalsA = 0;

  for (let start = 0; start + BASE <= pcm.length; start += hop) {
    const base = pcm.subarray(start, start + BASE);

    let sum = 0;
    for (let i = 0; i < BASE; i++) sum += base[i] * base[i];
    const db = 20 * Math.log10(Math.sqrt(sum / BASE) + 1e-10);
    if (db < -45) {
      prevF0 = 0;
      continue;
    }

    const res = yin.detect(base.subarray(0, Math.min(base.length, yin.needed)));
    if (!res || res.clarity < 0.65 || !res.hz) {
      prevF0 = 0;
      continue;
    }

    if (prevF0 > 0 && Math.abs(res.hz / prevF0 - 1) > 0.3) {
      prevF0 = 0;
      continue;
    }
    prevF0 = res.hz;

    // 按 4.5 个周期重新截取，至少覆盖 2 个周期，避免极高音时窗过短
    const need = Math.max(Math.round(PERIODS * sampleRate / res.hz), Math.round(2 * sampleRate / res.hz));
    const center = start + (BASE >> 1);
    let from = center - (need >> 1);
    let to = from + need;
    if (from < 0) { from = 0; to = need; }
    if (to > pcm.length) { to = pcm.length; from = Math.max(0, to - need); }
    if (to - from < Math.round(2 * sampleRate / res.hz)) continue;
    const frame = pcm.subarray(from, to);

    const hnr = hnrFromAcf(frame, sampleRate, res.hz);
    if (hnr != null) hnrs.push(hnr);

    // 周期与抖动需要**更多周期**才稳。4.5 个周期只够算 HNR，只能得到 3 个间隔，
    // 抖动会因样本太少而不稳、甚至凑不够帧（test-vq 就是这么挂的）。
    // 所以这里单独用「至少 10 个周期」的窗——Praat 的 PointProcess 也是在全窗上做的。
    const pNeed = Math.max(Math.round(10 * sampleRate / res.hz), BASE);
    let pf = center - (pNeed >> 1);
    let pt = pf + pNeed;
    if (pf < 0) { pf = 0; pt = pNeed; }
    if (pt > pcm.length) { pt = pcm.length; pf = Math.max(0, pt - pNeed); }
    const info = extractPeriods(pcm.subarray(pf, pt), sampleRate, res.hz);
    if (!info || info.periods.length < 3) continue;

    let dt = 0;
    let da = 0;
    let validPairs = 0;
    let validAPairs = 0;
    let periodSum = 0;
    let ampSum = 0;

    for (let i = 1; i < info.periods.length; i++) {
      const p1 = info.periods[i - 1];
      const p2 = info.periods[i];
      // 对齐 Praat / Koenami: maximum_period_factor = 1.3 门控
      // 周期跳变超过 30% 属于声调滑移、音渡或八度突跳，非声带微抖动
      if (Math.max(p1 / p2, p2 / p1) >= 1.3) continue;
      dt += Math.abs(p1 - p2);
      periodSum += (p1 + p2) / 2;
      validPairs++;

      if (i < info.amps.length) {
        const a1 = info.amps[i - 1];
        const a2 = info.amps[i];
        // 对齐 Praat / Koenami: maximum_amplitude_factor = 1.6 门控
        if (a1 > 0 && a2 > 0 && Math.max(a1 / a2, a2 / a1) < 1.6) {
          da += Math.abs(a1 - a2);
          ampSum += (a1 + a2) / 2;
          validAPairs++;
        }
      }
    }

    if (validPairs < 2) continue;

    // 抖动/闪烁全局聚合（对齐 Praat local jitter 与 SVT 门控）：
    // 剔除离群异常帧（上限 6.0% / 18.0%），累计有效周期的微扰与基准
    const jitterFrame = (dt / periodSum) * 100;
    if (jitterFrame > JIT_CAP) {
      droppedJitter += 1;
    } else {
      sumDt += dt;
      sumPeriod += periodSum;
      sumIntervals += validPairs;
    }

    if (validAPairs >= 2) {
      const shimmerFrame = (da / ampSum) * 100;
      if (shimmerFrame > SHIM_CAP) {
        droppedShimmer += 1;
      } else {
        sumDa += da;
        sumAmp += ampSum;
        sumIntervalsA += validAPairs;
      }
    }

    periodFrames += 1;
  }

  return {
    jitterPct: sumPeriod ? parseFloat(((sumDt / sumPeriod) * 100).toFixed(2)) : null,
    shimmerPct: sumAmp ? parseFloat(((sumDa / sumAmp) * 100).toFixed(2)) : null,
    hnrDb: hnrs.length ? parseFloat(mean(hnrs).toFixed(1)) : null,
    // 被丢帧的比例。0 表示这次看到的就是全部；>0 表示数值是下界
    droppedFrameRatio: periodFrames ? Number(((droppedJitter + droppedShimmer) / (periodFrames * 2)).toFixed(2)) : null,
    periodFrames,
  };
}

/**
 * 计算全维度基础音高与发声统计数据
 * @param {Array<{t: number, hz: number|null, clarity: number, db: number}>} frames
 */
export function computeExtendedStats(frames) {
  if (!frames || !frames.length) return null;

  const voiced = frames.filter((f) => f.hz != null && f.clarity >= 0.55 && f.db > -49);
  const totalFrames = frames.length;
  const voicedFrames = voiced.length;
  const voicedSec = parseFloat((voicedFrames * 0.025).toFixed(1));
  const voicedPct = totalFrames ? Math.round((voicedFrames / totalFrames) * 100) : 0;

  if (!voiced.length) {
    return {
      meanF0: null,
      stdDevSt: null,
      minF0: null,
      maxF0: null,
      maleZonePct: 0,
      midZonePct: 0,
      femaleZonePct: 0,
      voicedSec,
      voicedPct,
      meanDb: null,
      maxDb: null,
    };
  }

  const hzList = voiced.map((f) => f.hz).sort((a, b) => a - b);
  const sumF0 = hzList.reduce((s, v) => s + v, 0);
  const meanF0 = Math.round(sumF0 / hzList.length);

  // 半音标准差
  const stList = hzList.map((hz) => 12 * Math.log2(hz / 440));
  const stMean = stList.reduce((s, v) => s + v, 0) / stList.length;
  const stVar = stList.reduce((s, v) => s + (v - stMean) * (v - stMean), 0) / stList.length;
  const stdDevSt = parseFloat(Math.sqrt(stVar).toFixed(1));

  // 音区占比：男声区 <145Hz, 过渡区 145-175Hz, 女声区 >175Hz
  let maleCount = 0, midCount = 0, femaleCount = 0;
  for (const hz of hzList) {
    if (hz < 145) maleCount++;
    else if (hz <= 175) midCount++;
    else femaleCount++;
  }

  const maleZonePct = Math.round((maleCount / hzList.length) * 100);
  const midZonePct = Math.round((midCount / hzList.length) * 100);
  const femaleZonePct = Math.round((femaleCount / hzList.length) * 100);

  // 极值 (P05 与 P95 截断抗爆音)
  const minF0 = Math.round(hzList[Math.floor(hzList.length * 0.03)]);
  const maxF0 = Math.round(hzList[Math.floor(hzList.length * 0.97)]);

  // 响度
  const dbs = frames.map((f) => f.db).filter((db) => db > -60);
  const meanDb = dbs.length ? parseFloat((dbs.reduce((s, v) => s + v, 0) / dbs.length).toFixed(1)) : -30;
  const maxDb = dbs.length ? parseFloat(Math.max(...dbs).toFixed(1)) : -15;

  return {
    meanF0,
    stdDevSt,
    minF0,
    maxF0,
    maleZonePct,
    midZonePct,
    femaleZonePct,
    voicedSec,
    voicedPct,
    meanDb,
    maxDb,
  };
}
