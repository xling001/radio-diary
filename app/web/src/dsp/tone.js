/**
 * tone.js — 中文普通话声调与嘎裂声 (Creaky Voice) 巡航引擎
 *
 * 核心创新：
 *   1. 说话人基准归一化半音：ST_norm = 12 * log2(F0 / medianF0)
 *   2. 双模式设计 (采纳 Argon 建议)：
 *      - 模式 A (词卡与朗读模式)：能量谷切分音节 + 多项式拟合 + 软四声模板比对
 *      - 模式 B (自由说话巡航模式)：全局 p10 底边监测 + 嘎裂帧占比巡航
 *   3. 嘎裂声加权或门检测 (倍周期型 OR 非周期声门坍塌型)
 *   4. 个人专属 floorF0 安全托底线自动计算
 */

/**
 * 将赫兹转换为半音 (以 440 Hz 为 A4 = 69)
 */
export function hzToSemitone(hz) {
  if (!hz || hz <= 0) return null;
  return 12 * Math.log2(hz / 440) + 69;
}

/**
 * 说话人基准归一化：减去练习者自身当次的中位数半音
 */
export function normalizeSemitones(frames, medianF0) {
  if (!medianF0 || medianF0 <= 0) return [];
  const medianSt = hzToSemitone(medianF0);
  return frames.map(f => {
    if (!f.hz || f.hz <= 0) {
      return { ...f, stNorm: null };
    }
    const st = hzToSemitone(f.hz);
    return { ...f, stNorm: parseFloat((st - medianSt).toFixed(2)) };
  });
}

/**
 * 嘎裂声 (Creaky Voice / Vocal Fry) 加权或门检测器
 *
 * @param {Array<{t: number, hz: number|null, clarity: number, db: number}>} frames
 * @param {number|null} p10Hz 该录音的第 10 百分位基频
 * @returns {Array<boolean>} 每帧是否为嘎裂帧
 */
export function detectCreakFrames(frames, p10Hz = null) {
  const n = frames.length;
  const isCreak = new Array(n).fill(false);
  const effectiveP10 = (Number.isFinite(p10Hz) && p10Hz > 0) ? p10Hz : 120;
  const floorThreshold = effectiveP10 * 1.08;

  for (let i = 1; i < n; i++) {
    const cur = frames[i];
    const prev = frames[i - 1];

    // 静音或环境弱音不检
    if (cur.db < -48) continue;

    // 条件 1：倍周期型 (Period Halving / 倍频骤跳)
    // 表现为局部 F0 陡降超过 7 个半音，或瞬间跌到前一帧的一半左右
    if (cur.hz && prev.hz) {
      const ratio = cur.hz / prev.hz;
      if (ratio < 0.62) {
        // 跌落型倍周期骤降
        if (cur.hz < floorThreshold || Math.abs(cur.db - prev.db) > 6) {
          isCreak[i] = true;
          continue;
        }
      } else if (ratio > 1.68) {
        // 上跳型：仅当在低音托底区且能量骤变时才判为嘎裂抖动，避免 T3->T1 起调被误判为嘎裂
        if (prev.hz < floorThreshold && Math.abs(cur.db - prev.db) > 6) {
          isCreak[i] = true;
          continue;
        }
      }
    }

    // 条件 2：非周期声门坍塌型 (Aperiodic Collapse)
    // 练习者在下探时声带未闭牢或挤卡，进入低置信度灰区 (0.35 ~ 0.62)，且能量出现骤降
    if (cur.clarity >= 0.35 && cur.clarity <= 0.64) {
      // 检查前序帧是否在下探，且当前能量明显低于语音正常区间
      if (prev.hz && prev.hz < floorThreshold) {
        const dbDrop = prev.db - cur.db;
        if (dbDrop > 5 || cur.db < -32) {
          isCreak[i] = true;
          continue;
        }
      }
    }
  }

  // 平滑去噪：连续 2 帧以上标记才算有效嘎裂事件
  const smoothed = new Array(n).fill(false);
  for (let i = 0; i < n - 1; i++) {
    if (isCreak[i] && (isCreak[i - 1] || isCreak[i + 1])) {
      smoothed[i] = true;
    }
  }
  return smoothed;
}

/**
 * 能量谷音节切分算法 (用于定长词卡与短句)
 * 寻找能量低于局部语音峰值 18 dB 且持续时间合理的静音谷
 */
export function segmentSyllables(frames, stepSec = 0.025) {
  const syllables = [];
  let inSyl = false;
  let sylStart = 0;
  let speechMaxDb = -60;

  for (const f of frames) {
    if (f.hz && f.clarity >= 0.6) speechMaxDb = Math.max(speechMaxDb, f.db);
  }
  const valleyThresh = Math.max(-50, speechMaxDb - 18);

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const isVoiced = f.hz && f.clarity >= 0.55 && f.db > valleyThresh;

    if (isVoiced && !inSyl) {
      inSyl = true;
      sylStart = i;
    } else if (!isVoiced && inSyl) {
      // 检查音节长度是否合理 (至少 80ms = 3 帧以上)
      if (i - sylStart >= 3) {
        syllables.push({ startIdx: sylStart, endIdx: i });
      }
      inSyl = false;
    }
  }
  if (inSyl && frames.length - sylStart >= 3) {
    syllables.push({ startIdx: sylStart, endIdx: frames.length });
  }

  return syllables;
}

/**
 * 对单音节进行二阶多项式拟合：y(t) = a*t^2 + b*t + c (t 归一化至 [0, 1])
 */
function fitPolynomial(stNormValues) {
  const N = stNormValues.length;
  if (N < 2) return null;

  // 只需要线性拟合的均值项。
  // 原实现还累加了 sumT2/sumT3/sumT4/sumT2Y（二阶多项式要用），但那套从未被使用——
  // 留着会让后来的人以为这里有二次拟合（docs/14 审计发现过这个死代码）。
  let sumT = 0;
  let sumY = 0;
  for (let i = 0; i < N; i++) {
    sumT += N === 1 ? 0 : i / (N - 1);
    sumY += stNormValues[i];
  }
  const meanT = sumT / N;
  const meanY = sumY / N;
  let num = 0, den = 0;
  for (let i = 0; i < N; i++) {
    const t = N === 1 ? 0 : i / (N - 1);
    num += (t - meanT) * (stNormValues[i] - meanY);
    den += (t - meanT) * (t - meanT);
  }
  const slope = den !== 0 ? num / den : 0; // 全程斜率变化 (半音)

  const startVal = stNormValues[0];
  const endVal = stNormValues[N - 1];
  const minVal = Math.min(...stNormValues);
  const maxVal = Math.max(...stNormValues);

  return { slope, startVal, endVal, minVal, maxVal };
}

/**
 * 综合声调与健康度分析主入口
 *
 * @param {Array<{t: number, hz: number|null, clarity: number, db: number}>} frames
 * @param {number} medianF0 该段音频基频中位数
 * @param {number} p10F0 第10百分位基频
 * @param {number} floorF0 用户个人专属托底安全线 (若未设默认 p10F0 * 1.05)
 * @param {'free'|'script'} mode 自由说 或 读素材
 */
export function analyzeToneAndHealth(frames, medianF0, p10F0, floorF0 = null, mode = 'free', spectral = null) {
  if (!frames || frames.length < 15 || !medianF0) {
    return {
      ok: false,
      creakRatio: 0,
      floorSafe: true,
      summary: '录音太短，声调走势暂不明显',
      issues: []
    };
  }

  const normFrames = normalizeSemitones(frames, medianF0);
  const creakFrames = detectCreakFrames(frames, p10F0);
  // 个人托底线：取练习者自身 p10 的 95%，兜底不低于 90 Hz，避免新手基频偏低时被误伤
  const autoFloor = (Number.isFinite(p10F0) && p10F0 > 0)
    ? Math.max(90, p10F0 * 0.95)
    : 120;
  const targetFloor = floorF0 || autoFloor;
  const referenceFloorHz = 160; // 郭婷婷 2021 普通话顺女常模参考线，仅作坐标参考，不作为个人评判

  let voicedCount = 0;
  let creakCount = 0;
  let belowFloorCount = 0;

  for (let i = 0; i < frames.length; i++) {
    // 嘎裂帧本身周期性下降，允许置信度门限更宽 (≥ 0.35)
    if (creakFrames[i] || (frames[i].hz && frames[i].clarity >= 0.35 && frames[i].db > -50)) {
      voicedCount++;
      if (creakFrames[i]) creakCount++;
      if (frames[i].hz && frames[i].hz < targetFloor) belowFloorCount++;
    }
  }

  const creakRatio = voicedCount > 0 ? creakCount / voicedCount : 0;
  const floorSafeRatio = voicedCount > 0 ? (voicedCount - belowFloorCount) / voicedCount : 1.0;
  const issues = [];

  // 0. 高音区提喉/公鸭音挤卡先验诊断
  if (spectral && spectral.isDuckVoice) {
    issues.push({
      sylIndex: 0,
      timeSec: 0,
      type: 'duck_voice',
      desc: '高频咽腔能量偏多，常见于用上提喉头的方式去够高音的时候。试着半打哈欠把喉头放平，让气流把声音托出来'
    });
  }

  // 模式 A：词卡与朗读模式下的音节切分细诊
  if (mode === 'script') {
    const syllables = segmentSyllables(frames);
    for (let sIdx = 0; sIdx < syllables.length; sIdx++) {
      const syl = syllables[sIdx];
      const sylNorm = [];
      let sylCreak = 0;

      for (let j = syl.startIdx; j < syl.endIdx; j++) {
        if (normFrames[j].stNorm !== null) sylNorm.push(normFrames[j].stNorm);
        if (creakFrames[j]) sylCreak++;
      }

      if (sylNorm.length >= 3) {
        const poly = fitPolynomial(sylNorm);
        const sylDuration = (syl.endIdx - syl.startIdx) * 0.025;

        // 诊断 1：音节内部出现嘎裂
        if (sylCreak >= 2) {
          issues.push({
            sylIndex: sIdx + 1,
            timeSec: parseFloat((syl.startIdx * 0.025).toFixed(2)),
            type: 'creak',
            desc: `第 ${sIdx + 1} 个字落到底部时有点“卡/挤喉”`
          });
        }
        // 诊断 2：去声/上声过度深挖 (掉下中位数 5 个半音以上且坡度过陡)
        // 诊断 3：上扬过陡（原实现只判向下，往上滑完全不认——材料第 7 条练的就是滑上滑下）
        else if (poly.maxVal > 6 && poly.slope > 4.5) {
          issues.push({
            sylIndex: sIdx + 1,
            timeSec: parseFloat((syl.startIdx * 0.025).toFixed(2)),
            type: 'rise_too_steep',
            desc: `第 ${sIdx + 1} 个字往上冲得比较陡。上扬本身不是问题，但冲得太快容易把喉头一起带起来——试着把上扬匀开，别在末尾猛挑。`
          });
        }
        else if (poly.minVal < -5.5 && poly.slope < -4.5) {
          issues.push({
            sylIndex: sIdx + 1,
            timeSec: parseFloat((syl.startIdx * 0.025).toFixed(2)),
            type: 'drop_too_deep',
            desc: `第 ${sIdx + 1} 个字降得较深，建议改用“滑翔浅降”（如纸飞机掠过，尾音悬浮在托底线 ${Math.round(targetFloor)}Hz 上方微降即止）`
          });
        }
      }
    }
  }

  // 温和总结文案生成（克制表达，仅作参考）
  let summary = '声调走势整体较为平稳';
  if (spectral && spectral.isDuckVoice) {
    summary = '音高偏高，同时上咽腔的共鸣偏多，如觉得发紧可试试半打哈欠放松喉头';
  } else if (creakRatio > 0.15) {
    summary = '部分低音或句尾检测到气泡音/嘎裂，可能和气息下探有关';
  } else if (floorSafeRatio < 0.75) {
    summary = '部分音高落到了参考底线（' + Math.round(targetFloor) + ' Hz）以下，句尾可试着轻轻托住';
  } else if (mode === 'script' && issues.length > 0) {
    summary = `整体调子较稳，有 ${issues.length} 处下探或转折可以试着更轻一点`;
  }

  return {
    ok: true,
    creakRatio: parseFloat(creakRatio.toFixed(3)),
    floorSafe: floorSafeRatio >= 0.85,
    floorSafeRatio: parseFloat(floorSafeRatio.toFixed(3)),
    floorTargetHz: Math.round(targetFloor),
    autoFloorHz: Math.round(autoFloor),
    referenceFloorHz,
    summary,
    issues,
    creakFrames,
    normFrames
  };
}

/**
 * 逐段声调诊断：第三声 / 第四声触底与嘎裂（Chen et al. 2026 的核心问题）
 *
 * 依据：普通话跨女「Tones 3 and 4 often reach the modal-register floor and creaky voice」
 * ——抬高基线之后，上声的低点和去声的落点被挤出可用发声区，变成嘎裂。
 * 这比「音域被压缩」更具体、也更好做：嘎裂有鲜明特征（局部 f0 骤降 + 周期性丧失）。
 *
 * 与 analyzeToneAndHealth 的区别：那个按「音节」切分猜；这个吃 segments 的分段结果，
 * 一段就是一个事件，不会把一口气切成几截。
 *
 * @param {Array} segments buildSegments().list
 * @param {Array<{t:number,hz:number|null,clarity:number,db:number}>} frames
 * @param {number} medianF0 本次录音的基频中位数
 * @param {number} floorHz 个人托底线
 * @param {Array<boolean>} creakFrames 逐帧嘎裂标记（detectCreakFrames 的输出）
 */
export function diagnoseToneSegments(segments, frames, medianF0, floorHz, creakFrames) {
  if (!segments || !frames || !medianF0) return [];
  const centerSt = hzToSemitone(medianF0);
  const out = [];

  segments.filter((s) => s.kind === 'voiced').forEach((s, n) => {
    const idx = [];
    for (let j = 0; j < frames.length; j++) {
      if (frames[j].t >= s.startSec && frames[j].t < s.endSec) idx.push(j);
    }
    const st = idx.filter((j) => frames[j].hz != null).map((j) => hzToSemitone(frames[j].hz) - centerSt);
    if (st.length < 3) return;

    const minSt = Math.min(...st);
    const maxSt = Math.max(...st);
    const startSt = st[0];
    const endSt = st[st.length - 1];
    const drop = endSt - startSt;
    const creakCount = idx.filter((j) => creakFrames && creakFrames[j]).length;
    const creakRatio = idx.length ? creakCount / idx.length : 0;

    // 触底：低于个人托底线，或相对本人中位数掉了 6 个半音以上
    const floorHit = floorHz != null ? minSt < -6 || (floorHz > 0 && Math.min(...idx.filter((j) => frames[j].hz != null).map((j) => frames[j].hz)) < floorHz) : minSt < -6;

    // 判断顺序要讲究：先说方向，再说触底。
    // 原来把「触底」放在最前，结果一段明显上扬的调子只要中途探过低点，
    // 就会被说成「往下掉得比较深」——描述和实际走势相反。
    let desc = '这一段平稳';
    if (creakRatio > 0.15) {
      desc = `这一段有 ${Math.round(creakRatio * 100)}% 落在嘎裂上，是往下探的时候声带没兜住`;
    } else if (drop > 4) {
      desc = floorHit
        ? '这一段整体往上扬，但中途有一处探得比较低'
        : '这一段往上扬';
    } else if (floorHit) {
      desc = '这一段往下掉得比较深，快碰到底线了';
    } else if (drop < -4) {
      desc = '这一段是明显下行的调子';
    }

    out.push({
      index: n + 1,
      startSec: s.startSec,
      endSec: s.endSec,
      medianHz: s.medianHz,
      minSt: Number(minSt.toFixed(2)),
      maxSt: Number(maxSt.toFixed(2)),
      dropSt: Number(drop.toFixed(2)),
      creakRatio: Number(creakRatio.toFixed(2)),
      floorHit: !!floorHit,
      desc,
    });
  });

  return out;
}

/**
 * 自动标定用户的专属 floorF0 (安全托底线)
 * 扫描用户向下滑音中首次发生倍周期或置信度突跌的频率，上浮 2 个半音 (+12%)
 */
export function estimateFloorF0FromGlissando(frames) {
  for (let i = 2; i < frames.length; i++) {
    const cur = frames[i];
    const prev = frames[i - 1];
    if (cur.hz && prev.hz) {
      if (cur.hz / prev.hz < 0.65 || (cur.clarity < 0.5 && prev.clarity >= 0.7)) {
        // 找到崩塌临界频率，上浮 2 个半音 (即 2^(2/12) ≈ 1.122)
        const breakF0 = prev.hz;
        const safeFloor = Math.round(breakF0 * 1.122);
        return Math.min(Math.max(safeFloor, 140), 180); // 合理范围钳制
      }
    }
  }
  return 160; // 默认锁定 160 Hz（郭婷婷 2021 普通话顺女常模低音下界）
}
