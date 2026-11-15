/* ===========================================================
   metrics/kbNorms.js — 全系统声学常模唯一真相源 (KB v1.3.0 SSOT)

   【权威来源】
   严格以 docs/37 知识库《跨性别女性嗓音训练解剖与声学常模知识库(普通话版)》v1.3.0 为准。
   消除口径打架、多重阈值与不当断言。
   任何常模、参考区间、分析判语及 AI 提示词均须以此为基准。
   =========================================================== */

export const KB_VERSION = '1.3.0';

/**
 * 1. 音高与音区分布常模 (F0)
 * 汉语普通话女性化会话基准：
 * - 男声参考区：< 145 Hz
 * - 中性过渡区：145 ~ 175 Hz (ASHA 经典中性舒适带)
 * - 女声目标区：> 175 Hz (普通话顺女日常典型 180 ~ 230 Hz)
 */
export const PITCH_ZONES = Object.freeze({
  lowMax: 145,
  midMin: 145,
  midMax: 175,
  femaleTarget: 175,
  femaleTypicalMin: 180,
  femaleTypicalMax: 230,
});

/**
 * 2. 安全托底线常模 (Floor Target)
 * 保护尾音与三四声降调，避免跌入粗沉气泡音或压喉代偿：
 * - 推荐托底基线档位：150, 155, 160, 165 Hz (默认 160 Hz)
 * - 达标安全时间比：>= 85%
 */
export const FLOOR_SAFE = Object.freeze({
  defaultTargetHz: 160,
  safeRatioThreshold: 0.85,
  warningRatioThreshold: 0.75,
});

/**
 * 3. 语调起伏跨度常模 (Pitch Span · 半音 ST)
 * 剔除句尾淡出段的 P10–P90 核心半音跨度：
 * - 平缓集中：< 3.0 ST
 * - 自然连贯：3.0 ~ 6.0 ST (日常交流舒适带，长句典型 5 ~ 8 ST)
 * - 起伏生动：> 6.0 ST
 */
export const PITCH_SPAN = Object.freeze({
  flatMax: 3.0,
  naturalMax: 6.0,
  typicalMin: 5.0,
  typicalMax: 8.0,
});

/**
 * 4. 声门开商与音重常模 (H1 - H2 · dB)
 * 声带边缘振动的相对松紧与闭合形态：
 * - 偏紧用力 (Pressed)：< -1.2 dB (喉肌挤卡或压嗓警戒线)
 * - 舒展轻盈 (Balanced/Light)：-1.2 ~ 3.5 dB (健康轻音重，0 dB 附近为流动轻音重)
 * - 漏气微空 (Breathy)：> 3.5 dB
 */
export const H1_H2_WEIGHT = Object.freeze({
  pressedThreshold: -1.2,
  lightTargetMin: -0.5,
  lightTargetMax: 3.5,
  breathyThreshold: 3.5,
});

/**
 * 5. 声道微缩与共鸣间距常模 (ΔF · Hz)
 * 仅在前高元音 /i/（衣）提取的共振峰间距，代表前腔有效空间尺度：
 * - 腔体舒展 / 偏后：< 1050 Hz
 * - 中性偏明亮区间：1050 ~ 1250 Hz (普通话前腔聚焦典型 1000 ~ 1250 Hz)
 * - 前高微聚焦：> 1250 Hz (口腔容积紧凑、通透清亮)
 */
export const DELTA_F_SIZE = Object.freeze({
  relaxedMax: 1050,
  neutralMin: 1050,
  neutralMax: 1250,
  frontFocusedMin: 1250,
});

/**
 * 6. 基频微抖动常模 (Local Jitter · %)
 * 周期稳定性指标（必须严格区分稳态长音与连续语流，杜绝误报）：
 * - 稳态长元音 /a/：<= 1.1%
 * - 稳态长元音 /i/：<= 1.7%
 * - 连续语流朗读：1.8% ~ 2.8% (阈值放宽至 2.8%，正常会话不报粗糙)
 * 
 * 注：本实现采用移动端离散分帧窗格与二次插值估算，稳态长音背景噪声底约为 0.5%，
 * 因此长音 Jitter 测量值约为 Praat/PointProcess 连续金标准的 2~3 倍（如长音实测 0.8%~1.6%
 * 对应 Praat 0.4%~0.5%）。请勿直接拿本 App 长音数值与医学/Praat 门限（1.04%）直接跨平台对比，
 * 应以本 App 自身常模（/a/ <= 1.1%, /i/ <= 1.7%）与纵向自身对比为准。连续语流因真实抖动为主，
 * 两者尺度高度吻合（约 2.0%~2.5%）。
 */
export const JITTER_NORMS = Object.freeze({
  sustainedAMax: 1.1,
  sustainedIMax: 1.7,
  runningSpeechMax: 2.8,
});

/**
 * 7. 振幅微扰常模 (Local Shimmer · %)
 * 振幅能量波动指标：
 * - 稳态长元音：<= 4.5%
 * - 连续口语朗读参考上限：<= 8.0% (日常会话有重音起伏，偏高属正常现象)
 */
export const SHIMMER_NORMS = Object.freeze({
  sustainedMax: 4.5,
  runningSpeechMax: 8.0,
});

/**
 * 8. 咝音擦音摩擦重心常模 (Sibilance Centroid · Hz)
 * 清摩擦音 /s/、/x/ 的频谱能量重心：
 * - 参考可测范围：5.0 ~ 10.0 kHz
 * - 齿龈清脆女性化目标区间：6.0 ~ 8.5 kHz (中心约 7.5 kHz)
 */
export const SIBILANCE_NORMS = Object.freeze({
  fmin: 5000,
  targetMin: 6000,
  targetMax: 8500,
  fmax: 10000,
});

/**
 * 9. 谐噪比与纯净度常模 (HNR · dB)
 * 谐波能量与气流/环境噪声比：
 * - 微带气息/环境偏吵：< 9.0 dB
 * - 质感适中：9.0 ~ 14.0 dB
 * - 清澈纯净：>= 14.0 dB
 */
export const HNR_NORMS = Object.freeze({
  breathyMax: 9.0,
  moderateMax: 14.0,
  clearMin: 14.0,
});

/**
 * 10. 谐波衰减与谱倾斜说明 (H1–H5 & Spectral Tilt)
 * H1–H5 与频谱倾斜强依赖具体元音（同嗓音在 /a/ 与 /i/ 间可相差 40 dB 以上），
 * 仅作同一素材/同元音下的参考对比，不作跨句明暗诊断。
 */
export const HARMONICS_NORMS = Object.freeze({
  vowelDependent: true,
  note: 'F1~F3 反映口腔咽腔共鸣形状；H1~H5 反映谐波衰减（随所发元音自然变化，仅同素材可比）',
});

/* ===========================================================
   状态评估助手函数 (统一契约：{ chip, status, label, note, variant })
   =========================================================== */

/**
 * 评估 Jitter 状态
 * @param {number|null} jitter
 * @param {boolean} [isSustained=false]
 */
export function evaluateJitter(jitter, isSustained = false) {
  if (jitter == null || !Number.isFinite(jitter)) {
    return {
      chip: '未测出',
      status: '音高微抖动未测出',
      label: '音高微抖动未测出',
      note: '有效稳定浊音片段较少，暂不评估音高微抖动。',
      variant: 'slate',
      normal: true,
      level: 'ok',
    };
  }
  const thr = isSustained ? JITTER_NORMS.sustainedAMax : JITTER_NORMS.runningSpeechMax;
  if (jitter <= thr) {
    const chip = isSustained ? '长音平稳' : '语流平稳';
    return {
      chip,
      status: `${chip}（${jitter.toFixed(2)}%）`,
      label: chip,
      note: '音高周期变化较小，可能表示声带振动相对平稳。',
      variant: 'sage',
      normal: true,
      level: 'ok',
    };
  }
  if (jitter <= thr * 1.35) {
    return {
      chip: '轻微起伏',
      status: '音高微有起伏',
      label: '轻微起伏',
      note: '说话换气或句尾下降时出现轻微抖动比较常见，保持顺畅呼气即可。',
      variant: 'slate',
      normal: true,
      level: 'ok',
    };
  }
  return {
    chip: '偶有晃动',
    status: '音高周期偶有晃动',
    label: '偶有晃动',
    note: '局部周期晃动稍明显，如果感觉吃力，可以先喝口温水再试一段平稳长音对比。',
    variant: 'apricot',
    normal: false,
    level: 'warn',
  };
}

/**
 * 评估 Shimmer 状态
 * @param {number|null} shimmer
 * @param {boolean} [isSustained=false]
 */
export function evaluateShimmer(shimmer, isSustained = false) {
  if (shimmer == null || !Number.isFinite(shimmer)) {
    return {
      chip: '未测出',
      status: '音量稳定度未测出',
      label: '音量稳定度未测出',
      note: '有效连续浊音片段较少，暂不评估音量微颤。',
      variant: 'slate',
      normal: true,
      level: 'ok',
    };
  }
  const thr = isSustained ? SHIMMER_NORMS.sustainedMax : SHIMMER_NORMS.runningSpeechMax;
  if (shimmer <= thr) {
    return {
      chip: '音量均匀',
      status: '呼气与音量较均匀',
      label: '音量均匀',
      note: '发声时音量起伏较小，通常对应比较平稳的气流输出。',
      variant: 'sage',
      normal: true,
      level: 'ok',
    };
  }
  if (shimmer <= thr * 1.3) {
    return {
      chip: '微有起伏',
      status: '音量微有起伏',
      label: '微有起伏',
      note: '说话重音、换气或麦距变化时音量略有波动，属常见现象。',
      variant: 'slate',
      normal: true,
      level: 'ok',
    };
  }
  return {
    chip: '略微波动',
    status: '音量稳定度略有波动',
    label: '略微波动',
    note: '结尾或重音处音量波动稍多，可能和气息起伏或麦距变化有关。',
    variant: 'apricot',
    normal: false,
    level: 'warn',
  };
}

/**
 * 评估 H1-H2 音重状态
 * @param {number|null} h1h2
 */
export function evaluateH1H2(h1h2) {
  if (h1h2 == null || !Number.isFinite(h1h2)) {
    return {
      chip: '待确认',
      variant: 'slate',
      status: '发声轻重待测',
      label: '发声轻重待测',
      note: '部分元音（如「衣」）的共振峰容易和前两个谐波重叠；想测发声轻重，可平稳发 3 秒「啊 [a]」。',
      isPressed: false,
    };
  }
  if (h1h2 < H1_H2_WEIGHT.pressedThreshold) {
    return {
      chip: '偏实 / 偏紧',
      variant: 'apricot',
      status: '闭合偏实或偏紧',
      label: '闭合偏实或偏紧',
      note: '数值偏负，可能表示声带闭合偏实或用力稍多；如果自己感觉喉咙发紧，可以先喝口温水、轻轻叹口气再试。',
      isPressed: true,
    };
  }
  if (h1h2 >= H1_H2_WEIGHT.breathyThreshold) {
    return {
      chip: '轻柔 / 带气声',
      variant: 'sage',
      status: '轻柔带气声倾向',
      label: '轻柔带气声倾向',
      note: '数值偏高，可能表示发声比较轻柔或带一点气声；如觉得声音偏虚，可稍补一点平稳的气息支撑。',
      isPressed: false,
    };
  }
  return {
    chip: '轻重适中',
    variant: 'sage',
    status: '轻重适中 · 较为舒展',
    label: '轻重适中 · 较为舒展',
    note: '数值落在相对均衡的参考区间，通常对应不费力、不过度挤压的发声状态。',
    isPressed: false,
  };
}

/**
 * 评估 ΔF 共振峰间距状态
 * @param {number|null} deltaF
 */
export function evaluateDeltaF(deltaF) {
  if (deltaF == null || !Number.isFinite(deltaF)) {
    return {
      chip: '待测（需衣音）',
      variant: 'slate',
      status: '待测（需含「衣」音）',
      label: '共鸣间距待测（需含「衣」音）',
      note: '为减少圆唇带来的误差，ΔF 优先在清晰的「衣 [i]」音上估算；想测前腔共鸣可平稳发 3 秒「衣」。',
    };
  }
  if (deltaF >= DELTA_F_SIZE.frontFocusedMin) {
    return {
      chip: '前腔偏明亮',
      variant: 'sage',
      status: '前腔偏明亮紧凑',
      label: '前腔偏明亮紧凑',
      note: '共鸣间距偏宽，可能表示舌位偏前、口腔前部空间更紧凑，听感往往更清亮。',
    };
  }
  if (deltaF >= DELTA_F_SIZE.relaxedMax) {
    return {
      chip: '中性偏明亮',
      variant: 'sage',
      status: '中性偏明亮区间',
      label: '中性偏明亮区间',
      note: '落在常见的偏明亮参考范围（1050–1250 Hz）内，整体共鸣相对自然。',
    };
  }
  return {
    chip: '共鸣偏宽厚',
    variant: 'slate',
    status: '共鸣偏宽厚温和',
    label: '共鸣偏宽厚温和',
    note: '共鸣间距偏窄，可能表示口腔后部空间更宽、声音偏温厚；想提亮时可试试嘴角微展、舌尖轻靠下齿。',
  };
}

/**
 * 评估音高起伏（Pitch Span）状态
 * @param {number|null} spanSt
 */
export function evaluateSpan(spanSt) {
  if (spanSt == null || !Number.isFinite(spanSt)) {
    return {
      chip: '未测出',
      variant: 'slate',
      status: '音高起伏待测',
      label: '音高起伏待测',
      note: '连续浊音片段偏短，还不足以估算整句的音高起伏。',
    };
  }
  if (spanSt >= PITCH_SPAN.naturalMax) {
    return {
      chip: '起伏较丰富',
      variant: 'rose',
      status: '音高起伏较丰富',
      label: '音高起伏较丰富',
      note: '句中核心段音高跨度较大，语调起伏比较明显。',
    };
  }
  if (spanSt >= PITCH_SPAN.flatMax) {
    return {
      chip: '起伏自然',
      variant: 'rose',
      status: '音高起伏自然',
      label: '音高起伏自然',
      note: '落在日常说话常见的起伏范围（3.0–6.0 半音）内。',
    };
  }
  return {
    chip: '较为平缓',
    variant: 'slate',
    status: '音高较为平稳集中',
    label: '音高较为平稳集中',
    note: '音高主要集中在相近高度（单音练习很常见）；读句子时可在句尾带一点自然起伏。',
  };
}

/**
 * 评估咝音重心状态
 * @param {number|null} sibilanceHz
 */
export function evaluateSibilance(sibilanceHz) {
  if (sibilanceHz == null || !Number.isFinite(sibilanceHz)) {
    return {
      chip: '未检出',
      variant: 'slate',
      status: '未检出清擦音',
      label: '未检出清擦音',
      note: '这段录音里未包含足够的「丝 [s]」类高频摩擦片段。',
    };
  }
  if (sibilanceHz >= SIBILANCE_NORMS.targetMin && sibilanceHz <= SIBILANCE_NORMS.targetMax) {
    return {
      chip: '清脆前置',
      variant: 'sage',
      status: '偏清脆前置（6.0–8.5 kHz）',
      label: '偏清脆前置',
      note: '重心落在 6.0–8.5 kHz 常见清脆区间，可能表示舌尖靠前、气流较集中。',
    };
  }
  if (sibilanceHz > SIBILANCE_NORMS.targetMax) {
    return {
      chip: '重心偏高',
      variant: 'rose',
      status: '重心偏高偏尖（>8.5 kHz）',
      label: '重心偏高',
      note: '重心高于 8.5 kHz，摩擦位置很靠前；若觉得齿音略尖，可稍微柔化舌尖气流。',
    };
  }
  return {
    chip: '重心偏低',
    variant: 'slate',
    status: '重心偏低偏厚（<6.0 kHz）',
    label: '重心偏低',
    note: '重心低于 6.0 kHz，擦音可能偏厚；发「丝 [s]」时让舌尖靠近下齿背或前齿龈，重心通常会前移。',
  };
}

/**
 * 聚合常模命名空间对象 (Single Source of Truth)
 */
export const kbNorms = Object.freeze({
  version: KB_VERSION,
  pitchZones: PITCH_ZONES,
  floorSafe: FLOOR_SAFE,
  pitchSpan: PITCH_SPAN,
  weight: H1_H2_WEIGHT,
  resonance: DELTA_F_SIZE,
  jitter: JITTER_NORMS,
  shimmer: SHIMMER_NORMS,
  sibilance: SIBILANCE_NORMS,
  hnr: HNR_NORMS,
  harmonics: HARMONICS_NORMS,
  evaluateJitter,
  evaluateShimmer,
  evaluateH1H2,
  evaluateDeltaF,
  evaluateSpan,
  evaluateSibilance,
});

