/* ===========================================================
   metrics/normalizeStats.js — 统计对象归一化适配层 (SSOT)

   统一归一化录音统计对象，抹平数据契约、深层字段与历史版本差异。
   保证界面详细声学表、指标卡片与 AI 提示词导出使用单一真实口径。
   =========================================================== */

/**
 * 统一归一化录音统计对象
 * @param {object} takeOrStats 录音 take 对象或 take.stats 对象
 * @returns {object} 归一化后的标准对象
 */
export function normalizeStats(takeOrStats) {
  const take = (takeOrStats && takeOrStats.stats) ? takeOrStats : null;
  const s = take ? take.stats : (takeOrStats || {});
  const ext = s.ext || {};
  const vq = s.voiceQuality || {};
  const sv = s.spectral || s.spectralVoice || {};

  // 基频音高
  const medianF0 = (s.medianF0 != null && Number.isFinite(s.medianF0)) ? s.medianF0 : null;
  const meanF0 = (ext.meanF0 != null && Number.isFinite(ext.meanF0))
    ? ext.meanF0
    : ((s.meanF0 != null && Number.isFinite(s.meanF0)) ? s.meanF0 : medianF0);
  const minF0 = (ext.minF0 != null && Number.isFinite(ext.minF0))
    ? ext.minF0
    : ((s.minF0 != null && Number.isFinite(s.minF0)) ? s.minF0 : (s.p10 ?? null));
  const maxF0 = (ext.maxF0 != null && Number.isFinite(ext.maxF0))
    ? ext.maxF0
    : ((s.maxF0 != null && Number.isFinite(s.maxF0)) ? s.maxF0 : (s.p90 ?? null));
  const p10 = (s.p10 != null && Number.isFinite(s.p10)) ? s.p10 : null;
  const p90 = (s.p90 != null && Number.isFinite(s.p90)) ? s.p90 : null;
  const spanSt = (s.spanSt != null && Number.isFinite(s.spanSt)) ? s.spanSt : null;
  const stdF0St = (ext.stdDevSt != null && Number.isFinite(ext.stdDevSt))
    ? ext.stdDevSt
    : ((ext.stdF0St != null && Number.isFinite(ext.stdF0St)) ? ext.stdF0St : (s.stdF0St ?? null));

  // 音区分布（扁平字段优先）
  const maleZonePct = ext.maleZonePct != null ? ext.maleZonePct : null;
  const midZonePct = ext.midZonePct != null ? ext.midZonePct : null;
  const femaleZonePct = ext.femaleZonePct != null ? ext.femaleZonePct : null;

  // 共鸣与共振峰
  const deltaF = (s.deltaF != null && Number.isFinite(s.deltaF)) ? s.deltaF : null;
  const lengthCm = (s.lengthCm != null && Number.isFinite(s.lengthCm)) ? s.lengthCm : null;
  const f1 = (s.avgF1 != null && Number.isFinite(s.avgF1)) ? s.avgF1 : null;
  const f2 = (s.avgF2 != null && Number.isFinite(s.avgF2)) ? s.avgF2 : null;
  const f3 = (s.avgF3 != null && Number.isFinite(s.avgF3))
    ? s.avgF3
    : ((s.formants?.avgF3 != null && Number.isFinite(s.formants.avgF3)) ? s.formants.avgF3 : null);
  const f4 = (s.avgF4 != null && Number.isFinite(s.avgF4))
    ? s.avgF4
    : ((s.formants?.avgF4 != null && Number.isFinite(s.formants.avgF4)) ? s.formants.avgF4 : null);

  // 咝音
  const sibilanceCentroid = (s.sibilance && s.sibilance.centroidHz != null && Number.isFinite(s.sibilance.centroidHz))
    ? s.sibilance.centroidHz
    : null;

  // 时长与发音
  const totalSec = ext.totalSec ?? s.durationSec ?? (take ? take.durationSec : null);
  const voicedSec = ext.voicedSec != null
    ? ext.voicedSec
    : (s.voicedFrames ? s.voicedFrames * 0.025 : (s.voicedCount ? s.voicedCount * 0.025 : null));
  const voicedPct = ext.voicedPct != null
    ? ext.voicedPct
    : (totalSec && voicedSec ? Math.round((voicedSec / totalSec) * 100) : null);

  // 响度
  const meanDb = ext.meanDb != null ? ext.meanDb : null;
  const peakDb = ext.maxDb != null ? ext.maxDb : (s.levelDb ?? null);

  // 音质与声带
  const jitter = (vq.jitterLocalPct != null && Number.isFinite(vq.jitterLocalPct))
    ? vq.jitterLocalPct
    : ((s.jitter != null && Number.isFinite(s.jitter)) ? s.jitter : null);
  const shimmer = (vq.shimmerLocalPct != null && Number.isFinite(vq.shimmerLocalPct))
    ? vq.shimmerLocalPct
    : ((s.shimmer != null && Number.isFinite(s.shimmer)) ? s.shimmer : null);
  const hnr = (s.hnr != null && Number.isFinite(s.hnr))
    ? s.hnr
    : ((vq.hnrDb != null && Number.isFinite(vq.hnrDb)) ? vq.hnrDb : null);
  const h1h2 = (sv.h1h2Db != null && Number.isFinite(sv.h1h2Db))
    ? sv.h1h2Db
    : ((sv.h1_h2_db != null && Number.isFinite(sv.h1_h2_db))
      ? sv.h1_h2_db
      : ((s.h1_h2 != null && Number.isFinite(s.h1_h2)) ? s.h1_h2 : null));
  const twang = (sv.twangDb != null && Number.isFinite(sv.twangDb))
    ? sv.twangDb
    : ((s.twangDb != null && Number.isFinite(s.twangDb)) ? s.twangDb : null);
  const pitchHalving = (sv.pitchHalvingPct != null && Number.isFinite(sv.pitchHalvingPct))
    ? sv.pitchHalvingPct
    : ((s.pitchHalving != null && Number.isFinite(s.pitchHalving)) ? s.pitchHalving : null);
  const creakRatio = (s.tone && s.tone.creakRatio != null && Number.isFinite(s.tone.creakRatio))
    ? s.tone.creakRatio
    : null;
  const floorSafeRatio = (s.tone && s.tone.floorSafeRatio != null && Number.isFinite(s.tone.floorSafeRatio))
    ? Math.round(s.tone.floorSafeRatio * 100)
    : null;
  const floorTargetHz = (s.tone && s.tone.floorTargetHz != null && Number.isFinite(s.tone.floorTargetHz))
    ? s.tone.floorTargetHz
    : null;
  const status = sv.status || null;
  const isPressed = sv.isPressed === true;
  const isDuckVoice = sv.isDuckVoice === true;

  // v2.0.1 谐波谱、频谱倾斜与音色象限诊断
  const harmonicsDb = Array.isArray(sv.harmonicsDb) && sv.harmonicsDb.length === 5
    ? sv.harmonicsDb
    : null;
  const harmonicsRelDb = Array.isArray(sv.harmonicsRelDb) && sv.harmonicsRelDb.length === 5
    ? sv.harmonicsRelDb
    : (harmonicsDb && harmonicsDb[0] != null
      ? harmonicsDb.map((v) => (v != null && Number.isFinite(v) ? Number((v - harmonicsDb[0]).toFixed(2)) : null))
      : null);
  const harmonicsBars = Array.isArray(sv.harmonicsBars) && sv.harmonicsBars.length === 5
    ? sv.harmonicsBars
    : null;
  const h1h5Source = sv.h1h5Source || null;
  const h1h5Db = (sv.h1h5Db != null && Number.isFinite(sv.h1h5Db)) ? sv.h1h5Db : null;
  const spectralTiltDbOct = (sv.spectralTiltDbOct != null && Number.isFinite(sv.spectralTiltDbOct))
    ? sv.spectralTiltDbOct
    : null;
  const spectralStatus = sv.status || null;
  const spectralAdvice = sv.advice || null;
  const skippedByFormant = (sv.h1h2SkippedFormant != null && Number.isFinite(sv.h1h2SkippedFormant))
    ? sv.h1h2SkippedFormant
    : null;
  const framesVoiced = (sv.framesVoiced != null && Number.isFinite(sv.framesVoiced))
    ? sv.framesVoiced
    : null;
  const h1h2SkipPct = (sv.h1h2SkipPct != null && Number.isFinite(sv.h1h2SkipPct))
    ? sv.h1h2SkipPct
    : ((framesVoiced > 0 && skippedByFormant > 0) ? Math.round((skippedByFormant / framesVoiced) * 100) : null);
  const h1h2GuardActive = sv.h1h2GuardActive === true;
  const twangVowel = sv.twangVowel || null;
  const toneSummary = (s.tone && s.tone.summary) ? s.tone.summary : null;
  const toneIssues = (s.tone && Array.isArray(s.tone.issues)) ? s.tone.issues : [];
  const byVowel = (s.formants?.byVowel && typeof s.formants.byVowel === 'object')
    ? s.formants.byVowel
    : ((s.byVowel && typeof s.byVowel === 'object') ? s.byVowel : null);
  const vowelSamples = Array.isArray(s.vowelSamples)
    ? s.vowelSamples
    : (Array.isArray(s.formants?.vowelSamples) ? s.formants.vowelSamples : []);
  const dominantVowel = s.dominantVowel || s.formants?.dominant || null;
  let vowelScale = (s.formants?.vowelScale != null && Number.isFinite(s.formants.vowelScale))
    ? s.formants.vowelScale
    : null;

  // 若非高前元音 (/i/, /v/) 因强 H2/H3 误触发 F1 避让导致 h1h2 为空，从 harmonicsDb[0]-harmonicsDb[1] 恢复近似开商差
  let effH1H2 = h1h2;
  let h1h2Recovered = false;
  if (
    effH1H2 == null
    && h1h2GuardActive
    && skippedByFormant > 0
    && harmonicsDb
    && Number.isFinite(harmonicsDb[0])
    && Number.isFinite(harmonicsDb[1])
    && dominantVowel !== 'i'
    && dominantVowel !== 'v'
    && (f2 == null || f2 < 1650)
  ) {
    effH1H2 = Number((harmonicsDb[0] - harmonicsDb[1]).toFixed(1));
    h1h2Recovered = true;
  }

  // 当缺乏 /i/ 导致顶层 deltaF 为空时，由分元音加权 deltaF 或整体 F1~F4 推导参考共鸣间距 effDeltaF
  let effDeltaF = deltaF != null ? Math.round(deltaF) : null;
  if (effDeltaF == null && byVowel) {
    let wSum = 0;
    let wCnt = 0;
    for (const v of Object.values(byVowel)) {
      if (v && Number.isFinite(v.deltaF) && v.deltaF > 400 && v.deltaF < 2000) {
        const cnt = Number.isFinite(v.count) && v.count > 0 ? v.count : 1;
        wSum += v.deltaF * cnt;
        wCnt += cnt;
      }
    }
    if (wCnt > 0) effDeltaF = Math.round(wSum / wCnt);
  }
  if (effDeltaF == null && (!byVowel || Object.keys(byVowel).length > 0) && f1 && f2) {
    const terms = [f1 / 0.5, f2 / 1.5];
    if (f3) terms.push(f3 / 2.5);
    if (f4) terms.push(f4 / 3.5);
    const avgDf = terms.reduce((a, b) => a + b, 0) / terms.length;
    if (avgDf > 400 && avgDf < 2000) effDeltaF = Math.round(avgDf);
  }
  const effLengthCm = (lengthCm != null && Number.isFinite(lengthCm))
    ? Number(lengthCm.toFixed(1))
    : (effDeltaF ? Number((35000 / (2 * effDeltaF)).toFixed(1)) : null);

  // 结构化共振峰诊断标签（通俗简短，仅作参考）
  const activeDf = deltaF ?? effDeltaF;
  const formantDiag = {
    f1: f1 == null ? '待测' : (f1 < 380 ? '闭合较窄' : (f1 < 560 ? (f2 != null && f2 < 1350 ? '开口偏拢' : '中等开合') : (f1 >= 750 ? '开口舒展' : '自然适中'))),
    f2: f2 == null ? '待测' : (dominantVowel === 'i'
      ? (f2 >= 2300 ? '舌位偏前' : (f2 < 2050 ? '偏后参考' : '位置适中'))
      : (f2 < 1220 ? '偏后温厚' : (f2 < 1360 ? '中性偏后' : (f2 >= 1550 ? '前腔明亮' : '位置适中')))),
    f3: f3 == null ? '待测' : (f3 < 2620 ? '偏温厚' : (f3 < 2750 ? '中性' : '偏清亮')),
    df: activeDf == null ? '待测' : (activeDf < 1050 ? '共鸣偏宽' : (activeDf < 1110 ? '中性区间' : '紧凑明亮')),
  };

  const clampQ = (v) => Math.max(-0.92, Math.min(0.92, v));
  const MALE_CENTERS = {
    a: [730, 1275],
    o: [425, 765],
    e: [495, 1225],
    i: [330, 1950],
    u: [395, 850],
    v: [350, 1700],
  };

  // 闭口哼鸣守卫：H1-H2 偏高（>12.5）且无任何有效元音共振峰，不参与音色定位
  const isHum = (effH1H2 != null && effH1H2 > 12.5)
    && f1 == null
    && f2 == null
    && (!byVowel || Object.keys(byVowel).length === 0);

  // 象限纵轴 qY（+1 上方 = 偏实 / 已按压；-1 下方 = 更轻柔）
  const vOff = dominantVowel === 'i'
    ? 2.6
    : ((dominantVowel === 'e' && (f2 ?? 0) >= 1350) ? 1.2 : 0);
  const hCorr = (effH1H2 != null && !isHum && effH1H2 <= 12.5)
    ? Number((effH1H2 + vOff).toFixed(2))
    : null;

  let qY = null;
  let ySource = null;
  if (hCorr != null) {
    qY = clampQ((2.2 - hCorr) / 4.2);
    ySource = dominantVowel ? 'h1h2+vowel' : 'h1h2';
  }
  if (!isHum && spectralTiltDbOct != null && spectralTiltDbOct > -6.5 && (hCorr == null || hCorr < 1.8)) {
    // 频谱斜率平缓且开商不高时，高次胸声谐波（H2~H4）偏实
    qY = qY != null ? clampQ(Math.max(0.28, qY)) : 0.30;
    ySource = ySource || 'chestTilt';
  }
  if (isDuckVoice) {
    qY = qY != null ? clampQ(Math.max(0.55, qY)) : 0.72;
  } else if (isPressed && qY != null) {
    qY = clampQ(Math.max(0.32, qY));
  }
  if (qY != null) qY = Number(qY.toFixed(3));

  // 象限横轴 qX（-1 左侧 = 更深沉；+1 右侧 = 更明亮）
  let xRes = null;
  let xSource = null;
  if (!isHum) {
    if (deltaF != null) {
      xRes = clampQ((deltaF - 1080) / 130);
      xSource = 'deltaF';
    } else if (effDeltaF != null) {
      let rawRes = (effDeltaF - 1090) / 140;
      if (f2 != null && f2 < 1220 && dominantVowel !== 'o') {
        rawRes = Math.min(rawRes, (f2 - 1300) / 350);
      }
      xRes = clampQ(rawRes);
      xSource = 'effDeltaF';
    } else if (vowelScale != null) {
      xRes = clampQ((vowelScale - 1.09) / 0.14);
      xSource = 'vowelScale';
    } else if (byVowel) {
      const ratios = [];
      for (const [k, v] of Object.entries(byVowel)) {
        const ref = MALE_CENTERS[k];
        if (ref && v && Number.isFinite(v.f1) && Number.isFinite(v.f2) && v.f1 > 0 && v.f2 > 0) {
          ratios.push(0.5 * (v.f1 / ref[0] + v.f2 / ref[1]));
        }
      }
      if (ratios.length > 0) {
        const meanScale = ratios.reduce((acc, r) => acc + r, 0) / ratios.length;
        vowelScale = Number(meanScale.toFixed(3));
        xRes = clampQ((meanScale - 1.09) / 0.14);
        xSource = 'vowelScale';
      }
    }
    if (vowelScale == null && byVowel) {
      const ratios = [];
      for (const [k, v] of Object.entries(byVowel)) {
        const ref = MALE_CENTERS[k];
        if (ref && v && Number.isFinite(v.f1) && Number.isFinite(v.f2) && v.f1 > 0 && v.f2 > 0) {
          ratios.push(0.5 * (v.f1 / ref[0] + v.f2 / ref[1]));
        }
      }
      if (ratios.length > 0) {
        vowelScale = Number((ratios.reduce((acc, r) => acc + r, 0) / ratios.length).toFixed(3));
      }
    }
  }

  // 注意：平缓频谱斜率（如 -5.2 dB/oct）叠加低 H1-H2 (<1.8 dB) 属于胸声响亮而非女声明亮共鸣
  const chestHeavyTilt = effH1H2 != null && effH1H2 < 1.8;
  const xTilt = (!isHum && spectralTiltDbOct != null && !chestHeavyTilt)
    ? clampQ((spectralTiltDbOct - (-9.5)) / 4.5)
    : null;

  let qX = null;
  if (xRes != null && xTilt != null) {
    qX = Number((0.75 * xRes + 0.25 * xTilt).toFixed(3));
    xSource = `${xSource}+tilt`;
  } else if (xRes != null) {
    qX = Number(xRes.toFixed(3));
  } else if (xTilt != null) {
    qX = Number(xTilt.toFixed(3));
    xSource = 'tilt';
  }

  const errX = xSource ? (xSource.startsWith('deltaF') ? 0.16 : 0.24) : null;
  const errY = ySource ? 0.28 : null;
  const weightX = qY != null ? Number((-qY).toFixed(3)) : null;
  const sizeY = qX;
  const mode = (qX != null && qY != null)
    ? '2d'
    : (qY != null ? '1d-weight' : (qX != null ? '1d-size' : 'none'));

  // 跨支柱定位冲突（如高音但共鸣偏后暗 / 胸声偏实 -> 听感仍偏向中性/男声）
  const isHighPitch = medianF0 != null && medianF0 >= 170;
  const isDarkResonance = (qX != null && qX <= -0.18) || (f2 != null && f2 < 1240);
  const isHeavyWeight = (qY != null && qY >= 0.20) || (effH1H2 != null && effH1H2 < 1.5);
  const pitchResonanceMismatch = isHighPitch && (isDarkResonance || isHeavyWeight);

  let bottleneckHint = null;
  if (pitchResonanceMismatch) {
    const reasonsList = [];
    if (isDarkResonance) {
      const f2Msg = f2 != null ? `F2 (${Math.round(f2)} Hz) 提示舌位可能偏后` : '口腔共鸣可能偏宽厚';
      const dfMsg = activeDf != null ? `共鸣间距约 ${Math.round(activeDf)} Hz` : '';
      reasonsList.push([f2Msg, dfMsg].filter(Boolean).join('，'));
    }
    if (isHeavyWeight) {
      const wMsg = effH1H2 != null
        ? `H1-H2 (${effH1H2 > 0 ? '+' : ''}${effH1H2.toFixed(1)} dB)`
        : '中低频谐波';
      reasonsList.push(`${wMsg} 提示声带闭合可能偏实`);
    }
    const monoNote = (spanSt != null && spanSt < 1.2)
      ? '单音持续发声时通常比说话更容易抬高音高，因此频率上去了，听感仍可能由共鸣和轻重主导。'
      : '声音听感往往不只看音高，也和口腔共鸣、发声轻重有关。';
    bottleneckHint = `音高约 ${Math.round(medianF0)} Hz，同时 ${reasonsList.join('，且 ')}。${monoNote} 如果希望听感更轻亮，可试着嘴角微展、把吐字位置稍微往口腔前部带一点。`;
  }

  let summaryLabel = '浊音或共鸣样本偏少，暂只展示部分参考';
  let axisNote = '左图看前五个泛音衰减，右图看共鸣明暗（横轴）与发声轻重（纵轴），仅供参考';
  if (isHum) {
    summaryLabel = '闭口哼鸣样本 · 暂不做二维音色定位';
    axisNote = '闭口哼鸣缺少口腔元音共振峰，不参与共鸣与轻重定位';
  } else if (pitchResonanceMismatch) {
    summaryLabel = (isDarkResonance && isHeavyWeight)
      ? '音高偏高 · 共鸣偏宽且闭合偏实'
      : (isDarkResonance ? '音高偏高 · 共鸣空间偏宽厚' : '音高偏高 · 闭合偏实');
    axisNote = '左图看泛音衰减，右图横轴偏向共鸣明暗、纵轴偏向发声轻重，仅供参考';
  } else if (mode === '2d') {
    const brightSide = qX >= 0.18 ? '共鸣偏明亮' : (qX <= -0.18 ? '共鸣偏温厚' : '共鸣居中');
    const weightSide = qY >= 0.22 ? '闭合偏实' : (qY <= -0.22 ? '发声偏轻柔' : '轻重均衡');
    if (isDuckVoice) {
      summaryLabel = '音高偏高 · 伴随一定挤卡感';
    } else if (Math.abs(qX) <= 0.22 && Math.abs(qY) <= 0.22) {
      summaryLabel = '共鸣与发声轻重相对均衡';
    } else {
      summaryLabel = `${brightSide} · ${weightSide}`;
    }
    axisNote = '左图看泛音衰减，右图横轴表示共鸣明暗、纵轴表示发声轻重，适合同条件下的自我对比';
  } else if (mode === '1d-weight') {
    summaryLabel = qY <= -0.2 ? '单轴参考 · 发声偏轻柔' : (qY >= 0.22 ? '单轴参考 · 闭合偏实' : '单轴参考 · 轻重居中');
    axisNote = '本次缺少足够的前口腔元音点，仅定位纵轴（发声轻重）';
  } else if (mode === '1d-size') {
    summaryLabel = qX >= 0.18 ? '单轴参考 · 共鸣偏明亮' : (qX <= -0.18 ? '单轴参考 · 共鸣偏温厚' : '单轴参考 · 共鸣居中');
    axisNote = '本次受元音影响未测出 H1-H2，仅定位横轴（共鸣明暗）';
  } else if (sibilanceCentroid != null) {
    summaryLabel = '清擦音 [s] 专项练习';
    axisNote = '清擦音没有声带基频，重点看下方 6.0–8.5 kHz 咝音重心分布';
  }

  const quadrant = {
    mode,
    x: qX,
    y: qY,
    weightX,
    sizeY,
    xSource,
    ySource,
    errX,
    errY,
    hCorr,
    isHum,
    summaryLabel,
    axisNote,
  };

  return {
    s,
    ext,
    sv,
    vq,
    medianF0,
    meanF0,
    minF0,
    maxF0,
    p10,
    p90,
    spanSt,
    stdF0St,
    maleZonePct,
    midZonePct,
    femaleZonePct,
    deltaF,
    effDeltaF,
    lengthCm,
    effLengthCm,
    f1,
    f2,
    f3,
    f4,
    formantDiag,
    sibilance: sibilanceCentroid,
    sibilanceCentroid,
    floorSafeRatio,
    floorTargetHz,
    totalSec,
    voicedSec,
    voicedPct,
    meanDb,
    peakDb,
    jitter,
    shimmer,
    hnr,
    h1h2: effH1H2,
    rawH1H2: h1h2,
    h1h2Recovered,
    twang,
    pitchHalving,
    creakRatio,
    status,
    isPressed,
    isDuckVoice,
    harmonicsDb,
    harmonicsRelDb,
    harmonicsBars,
    h1h5Source,
    h1h5Db,
    spectralTiltDbOct,
    spectralStatus,
    spectralAdvice,
    skippedByFormant,
    framesVoiced,
    h1h2SkipPct,
    h1h2GuardActive,
    twangVowel,
    toneSummary,
    toneIssues,
    byVowel,
    vowelSamples,
    vowelScale,
    dominantVowel,
    bottleneckHint,
    quadrant,
  };
}
