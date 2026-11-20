/**
 * selfCheckSchema.js — 每周主观状态自评静态题目与情绪/场合枚举（纯数据定义，零存储/DOM 依赖）
 * 参考性别肯定言语治疗 (GAVT) 与 TVQ-MtF 去病理化自我觉察原则：不求总分、不贴等级、全可跳过。
 */

export const SELF_MOODS = [
  { emoji: '😊', label: '轻松', tone: 'mint' },
  { emoji: '😌', label: '平稳', tone: 'sky' },
  { emoji: '✨', label: '满意', tone: 'mint' },
  { emoji: '🌸', label: '很喜欢', tone: 'coral' },
  { emoji: '🤔', label: '摸索中', tone: 'lavender' },
  { emoji: '😮‍💨', label: '有点累', tone: 'amber' },
  { emoji: '🫂', label: '抱抱自己', tone: 'coral' },
];

export const SELF_CHECK_QUESTIONS = [
  {
    key: 'throatLoad',
    title: '1. 嗓音负荷与舒适感',
    prompt: '这周聊久一点或练完后，脖子与嗓子容易紧、干或累吗？',
    options: [
      '轻松省力',
      '偶尔微紧，喝水可缓',
      '说久容易累或干',
      '有明显疼痛或持续沙哑',
    ],
    redlineOption: '有明显疼痛或持续沙哑',
  },
  {
    key: 'socialEase',
    title: '2. 日常生活开口自在度',
    prompt: '这周接外卖/快递电话、点单或日常交流时，开口自在吗？',
    options: [
      '挺自然顺手',
      '能稳住，但心里会绷着',
      '还是容易紧张或回避',
      '这周主要自己练，暂未社交使用',
    ],
  },
  {
    key: 'listenerFeel',
    title: '3. 听者反馈感受（可跳过）',
    prompt: '这周在电话或陌生场合开口后，别人的称呼或反应让你感觉舒服吗？',
    options: [
      '大多让人开心舒服',
      '一半一半，看场合',
      '仍常被误认，有点失落',
      '这周先跳过这题',
    ],
  },
  {
    key: 'carryover',
    title: '4. 从练到说的迁移稳定度',
    prompt: '从「读素材」换回平时语速说话时，声音容易一下掉回原本低位吗？',
    options: [
      '基本能稳在舒适位置',
      '一赶时间或激动还是会掉',
      '需刻意托着，有点费脑',
      '这周主要靠自由照镜摸索',
    ],
  },
  {
    key: 'selfFit',
    title: '5. 声音自我接纳度',
    prompt: '隔天回听手账里的录音，这声音像你喜欢且接纳的自己吗？',
    options: [
      '很喜欢，越来越贴近自己',
      '还在慢慢熟悉磨合',
      '听回放还是有点别扭',
      '这周还没回听录音',
    ],
  },
];

export const SELF_CONTEXTS = [
  '自由照镜',
  '读素材',
  '做测试',
  '点单问路',
  '外卖快递电话',
  '职场通话会议',
  '熟人聊天',
  '故事连读',
];
