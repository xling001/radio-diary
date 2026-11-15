/**
 * metrics/segments.js — 事件级切分（把「整段一个数」变成「一段一段的数」）
 *
 * 为什么需要它：现在所有对外输出都是全段聚合（一个中位音高、一个 jitter），
 * 而训练材料要求的每一项都是「分段事件」——一口气撑了几秒、第 3 个音高到不到位。
 * 全段统计在这类问题上全部失效。
 *
 * 判据全部相对本次录音：不写死 dBFS，否则换手机就变（0.2.0 已踩过这个坑）。
 */

const HOP_SEC = 0.025;

/**
 * @param {Array<{t:number,hz:number|null,clarity:number,db:number}>} frames
 * @param {object} [opts]
 * @param {number} [opts.gapToleranceFrames] 允许被忽略的静音间隙（帧），默认 2（50ms）
 * @returns {{ list: Array, voicedLongestSec: number, count: number }}
 */
export function buildSegments(frames, opts = {}) {
  const gapTol = opts.gapToleranceFrames ?? 2;
  if (!frames || frames.length < 3) return { list: [], voicedLongestSec: 0, count: 0 };

  // 相对电平门限：p95 往下 35 dB（与 gating 同口径，避免绝对 dBFS）
  const dbs = frames.map((f) => f.db).slice().sort((a, b) => a - b);
  const pct = (q) => dbs[Math.min(dbs.length - 1, Math.max(0, Math.round((dbs.length - 1) * q)))];
  const silenceThr = Math.max(pct(0.05) + 8, pct(0.95) - 35);

  // 逐帧打标签：voiced（有音高）/ loud（有能量但测不到音高，疑似摩擦音或气声）/ silence
  const kinds = frames.map((f) => {
    if (f.db <= silenceThr) return 'silence';
    if (f.hz != null && f.clarity >= 0.55) return 'voiced';
    return 'loud';
  });

  // 合并成游程，允许短暂抖动（gapTol 帧以内不切分）
  const raw = [];
  for (let i = 0; i < frames.length; i++) {
    const k = kinds[i];
    if (!raw.length || raw[raw.length - 1].kind !== k) raw.push({ kind: k, from: i, to: i });
    else raw[raw.length - 1].to = i;
  }
  // 吸收过短的片段（< gapTol 帧）到前一段，避免音节间抖动把一段气流切成几截
  const merged = [];
  for (const r of raw) {
    const len = r.to - r.from + 1;
    if (len <= gapTol && merged.length) {
      merged[merged.length - 1].to = r.to;
    } else {
      merged.push({ ...r });
    }
  }

  const med = (a) => {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const list = [];
  for (const r of merged) {
    const slice = frames.slice(r.from, r.to + 1);
    const hz = slice.filter((f) => f.hz != null && f.clarity >= 0.55).map((f) => f.hz);
    const st = hz.map((v) => 12 * Math.log2(v / 440));
    const startSec = slice[0].t;
    const endSec = slice[0].t + slice.length * HOP_SEC;
    let stSd = null;
    if (st.length >= 3) {
      const mean = st.reduce((a, b) => a + b, 0) / st.length;
      stSd = Math.sqrt(st.reduce((a, b) => a + (b - mean) * (b - mean), 0) / st.length);
    }
    list.push({
      kind: r.kind,
      startSec: Number(startSec.toFixed(2)),
      endSec: Number(endSec.toFixed(2)),
      durationSec: Number((endSec - startSec).toFixed(2)),
      medianHz: hz.length ? Math.round(med(hz)) : null,
      semitoneSd: stSd == null ? null : Number(stSd.toFixed(2)),
      clarityMean: Number((slice.reduce((a, f) => a + (f.clarity || 0), 0) / slice.length).toFixed(2)),
      dbMean: Number((slice.reduce((a, f) => a + f.db, 0) / slice.length).toFixed(1)),
    });
  }

  return {
    list,
    count: list.length,
    voicedLongestSec: longestRun(list, 'voiced'),
    loudLongestSec: longestRun(list, 'loud'),
  };
}

/**
 * 某一类事件里最长的连续段（秒）。这就是 MPT 唯一正确的口径。
 * @param {Array} list buildSegments 产出的分段
 * @param {string} kind 'voiced' | 'loud' | 'silence'
 */
export function longestRun(list, kind) {
  let best = 0;
  for (const s of list || []) {
    if (s.kind === kind && s.durationSec > best) best = s.durationSec;
  }
  return Number(best.toFixed(2));
}

/**
 * 维持呼吸（MPT）两项。
 *
 * - 「啊」用**最长连续浊音段**（有音高）
 * - 「丝」用**最长连续有声但无音高的段**——这类纯气流段绕开了
 *   `4 kHz 以上占 50%` 那条门限。实测那条门限在手机麦克风上会把真实擦音误杀
 *   （5.35 秒的「丝」只有 26 帧通过），所以 MPT 绝不能复用它。
 *
 * 两者之比说明气流效率：丝明显长于啊 → 气到了声带这一关卡住了一部分。
 * 不做评分，只描述。
 */
export function phonationTimes(segRes) {
  const vowel = segRes?.voicedLongestSec ?? 0;
  const fric = segRes?.loudLongestSec ?? 0;
  let desc = null;
  if (vowel >= 1 && fric >= 1) {
    const ratio = fric / vowel;
    if (ratio >= 1.6) {
      desc = `气能吹 ${fric.toFixed(1)} 秒，但带声的「啊」只撑了 ${vowel.toFixed(1)} 秒——差得比较多，说明气到了声带这一关被卡住了一部分`;
    } else if (ratio <= 0.7) {
      // 反向比值：气声段比带声段还短很多，通常不是「气不够」，
      // 而是这次录音里根本没有一段长的纯气流（比如发的是带声的「丝」，或者时间太短）
      desc = `「丝」只有 ${fric.toFixed(1)} 秒、带声的「啊」有 ${vowel.toFixed(1)} 秒。这个比值反常——更可能是这次没录到一段真正持续的纯气流，而不是气不够`;
    } else {
      desc = `「丝」${fric.toFixed(1)} 秒、「啊」${vowel.toFixed(1)} 秒，两者接近，气流和声带的配合是稳的`;
    }
  } else if (fric >= 1) {
    desc = `「丝」撑了 ${fric.toFixed(1)} 秒（这次没测到持续带声的元音）`;
  } else if (vowel >= 1) {
    desc = `「啊」撑了 ${vowel.toFixed(1)} 秒（这次没测到持续的纯气流段）`;
  }
  return {
    vowelSec: Number(vowel.toFixed(2)),
    fricativeSec: Number(fric.toFixed(2)),
    desc,
  };
}
