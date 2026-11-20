/* ===========================================================
   core/index.js — 声学与算法层只读门面 (Core Read-only Facade)

   【架构红线】
   1. 视图层与组件一律不得直接 import dsp/ 或 metrics/，必须通过本门面取数。
   2. 保持本层纯净，禁止 import 任何 DOM / UI 代码，确保可在 Node.js 与 Web Worker 中独立运行。
   3. extractAudioFrames 与 summarize 为唯一官方声学输入/输出通道。
   =========================================================== */

import { extractAudioFrames } from '../audio/capture.js';
import { cleanPitchTrack, median, quantile, toSemitones } from '../dsp/pitch.js';
import { summarize, MDC, GATE, compareToBaseline } from '../metrics/gating.js';
import { normalizeStats } from '../metrics/normalizeStats.js';
import {
  KB_VERSION,
  PITCH_ZONES,
  FLOOR_SAFE,
  PITCH_SPAN,
  H1_H2_WEIGHT,
  DELTA_F_SIZE,
  JITTER_NORMS,
  SHIMMER_NORMS,
  SIBILANCE_NORMS,
  HNR_NORMS,
  HARMONICS_NORMS,
  evaluateJitter,
  evaluateShimmer,
  evaluateH1H2,
  evaluateDeltaF,
  evaluateSpan,
  evaluateSibilance,
  kbNorms,
} from '../metrics/kbNorms.js';

export const ALGO_VERSION = '0.5.0';
export { KB_VERSION };

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * 频率转换为西洋音名 (如 220Hz -> A3, 261.6Hz -> C4)
 * @param {number} hz
 * @returns {string}
 */
export function pitchName(hz) {
  if (!hz || hz <= 0 || !Number.isFinite(hz)) return '—';
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export {
  extractAudioFrames,
  cleanPitchTrack,
  median,
  quantile,
  toSemitones,
  summarize,
  normalizeStats,
  compareToBaseline,
  MDC,
  GATE,
  PITCH_ZONES,
  FLOOR_SAFE,
  PITCH_SPAN,
  H1_H2_WEIGHT,
  DELTA_F_SIZE,
  JITTER_NORMS,
  SHIMMER_NORMS,
  SIBILANCE_NORMS,
  HNR_NORMS,
  HARMONICS_NORMS,
  evaluateJitter,
  evaluateShimmer,
  evaluateH1H2,
  evaluateDeltaF,
  evaluateSpan,
  evaluateSibilance,
  kbNorms,
};

/**
 * 统一声学分析门面函数
 * @param {Float32Array} pcm - 音频波形
 * @param {number} sampleRate - 采样率
 * @param {object} [opts] - 可选配置项
 * @param {Array} [opts.frames] - 若已有提取好的帧则直接复用
 * @param {'free'|'script'} [opts.mode='free'] - 练习模式 ('free' | 'script')
 * @param {number|null} [opts.floorF0=null] - 托底基频
 * @returns {object} { algoVersion, frames, stats, ok, reasons }
 */
export function analyze(pcm, sampleRate, opts = {}) {
  const frames = opts.frames ?? extractAudioFrames(pcm, sampleRate, opts);
  const summary = summarize(
    frames,
    pcm,
    sampleRate,
    opts.mode ?? 'free',
    opts.floorF0 ?? null
  );
  return {
    algoVersion: ALGO_VERSION,
    frames,
    stats: summary.stats,
    ok: summary.ok,
    reasons: summary.reasons,
  };
}
