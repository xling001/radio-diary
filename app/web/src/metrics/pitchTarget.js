/**
 * metrics/pitchTarget.js — 绝对音高对靶（音阶阶梯、目标音）
 *
 * 为什么需要单独的模块：现有全套音高指标都是**自归一化**的
 * （`normalizeSemitones` 减去本次录音自己的中位数），
 * 所以能算「第 3 个音相对第 2 个偏了多少」，但**算不了「整条阶梯是不是整体偏高」**——
 * 整条唱高 2 个半音，归一化之后依然全是 0。
 *
 * 训练材料第 8/9 条（/m/ /mi/ 音阶阶梯、/ing/ 共鸣滑音）要求的恰恰是绝对对靶。
 *
 * 依据：Chen et al. 2026（26 名普通话跨女 / 5 周）用的是「设一个 F0 下限 + 在目标音高上哼唱」，
 * 也就是绝对靶点，不是相对起伏。
 */

/** 赫兹 → MIDI 半音号（A4 = 69 = 440 Hz） */
export function hzToSemitone(hz) {
  if (!hz || hz <= 0) return null;
  return 12 * Math.log2(hz / 440) + 69;
}

/** 目标偏差（半音）。正值 = 偏高 */
export function semitoneError(hz, targetHz) {
  if (!hz || !targetHz || hz <= 0 || targetHz <= 0) return null;
  return 12 * Math.log2(hz / targetHz);
}

/** 半音偏差 → 人话（不评分，只描述） */
export function describeError(errorSt, tolerance = 0.5) {
  if (errorSt == null) return '没测到';
  const a = Math.abs(errorSt);
  if (a <= tolerance) return '准的';
  const dir = errorSt > 0 ? '高' : '低';
  if (a <= 1) return `略${dir}一点`;
  if (a <= 2.5) return `比目标${dir}了约 ${a.toFixed(1)} 个半音`;
  return `比目标${dir}了 ${a.toFixed(1)} 个半音`;
}

/**
 * 把分段结果按顺序对上目标音。
 *
 * 只取 `kind === 'voiced'` 的段，按开始时间排序后依次对应目标。
 * 段数比目标少时，缺的级照样占位并标注，**不压缩、不错位**——
 * 少唱一级和唱错一级是两回事。
 *
 * @param {Array} segments buildSegments().list
 * @param {number[]} targetsHz 目标频率序列
 * @param {number} [tolerance] 判定为「准」的半音容差，默认 0.5
 */
export function matchLadder(segments, targetsHz, tolerance = 0.5) {
  const voiced = (segments || [])
    .filter((s) => s.kind === 'voiced' && s.medianHz)
    .sort((a, b) => a.startSec - b.startSec);

  return (targetsHz || []).map((targetHz, i) => {
    const s = voiced[i];
    if (!s) {
      return {
        index: i + 1,
        targetHz,
        measuredHz: null,
        errorSt: null,
        durationSec: null,
        stableSt: null,
        onTarget: false,
        desc: `第 ${i + 1} 级没测到`,
      };
    }
    const err = Number(semitoneError(s.medianHz, targetHz).toFixed(2));
    return {
      index: i + 1,
      targetHz,
      measuredHz: s.medianHz,
      errorSt: err,
      durationSec: s.durationSec,
      stableSt: s.semitoneSd ?? null,
      onTarget: Math.abs(err) <= tolerance,
      desc: `第 ${i + 1} 级 ${describeError(err, tolerance)}`,
    };
  });
}
