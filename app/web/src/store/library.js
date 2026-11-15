/**
 * library.js — 练习素材库管理 (内置对话、动作练习 + 自定义分类、标签与导入)
 */

export const CHECKUP_ITEMS = [
  {
    id: 'check_a',
    name: '「啊 [a]」长音测试（3秒）',
    shortLabel: '啊音',
    badge: '测声带松弛',
    vowelHint: '自然张口平稳发「啊——」约 3 秒',
    focus: '找轻松叹气般的轻柔和声带稳度（客观指标：开商 H1-H2、谐噪比 HNR）',
    prompt: '啊——————（轻松张口，像轻轻叹气般平稳保持 3 秒）',
    detailTip: '保持当下最轻松的状态自然开口即可，不需要刻意往高拉或压实音量；尽量维持平稳一条线 3 秒，前后留约半秒静音更利于测算。',
    targetSec: 3,
    requiresVoiced: true,
  },
  {
    id: 'check_i',
    name: '「衣 [i]」长音测试（3秒）',
    shortLabel: '衣音',
    badge: '测口腔亮度',
    vowelHint: '嘴角微展、舌面前部自然抬近硬腭发「衣——」约 3 秒',
    focus: '看前口腔是否推亮共鸣、舌面自然靠前（客观指标：F2 前移度与共振峰间距 ΔF）',
    prompt: '衣——————（嘴角微展，舌面前部轻抬，温和清亮地平稳保持 3 秒）',
    detailTip: '「衣 [i]」的核心是舌面前部自然抬高贴近硬腭，缩小前口腔空间；嘴角微展像轻笑即可，不要紧咬牙关或僵硬后缩舌根。',
    targetSec: 3,
    requiresVoiced: true,
  },
  {
    id: 'check_iau',
    name: '「衣 · 啊 · 乌」元音三角测试（5秒）',
    shortLabel: '元音三角',
    badge: '测元音空间',
    vowelHint: '依次清晰发「衣—啊—乌」各约 1.5 秒',
    focus: '对比三个方向画出你的元音空间轮廓（客观指标：F1-F2 分布、ΔF 与 H1-H2）',
    prompt: '衣—— 啊—— 乌——（三个单韵母各平稳发约 1.5 秒，中间略作停顿）',
    detailTip: '每个元音之间留极短停顿，吐字清楚即可；发「乌 [u]」时双唇轻圆但不必刻意压低音高或往喉底沉。',
    targetSec: 5,
    requiresVoiced: true,
  },
  {
    id: 'check_s',
    name: '「丝 [s]」齿龈咝音测试（3秒）',
    shortLabel: '丝音',
    badge: '测擦音前置',
    vowelHint: '纯吹气时声带不振动，没有实时音高线属正常，专注前唇齿细腻气流即可',
    focus: '感受前唇齿与上齿龈处集中不漏散的气流体感（结束后仅测算高频重心 6.0 ~ 8.5 kHz）',
    prompt: '丝——————（牙齿轻合留微缝，专注前唇齿处稳定细腻的气流声 2～3 秒）',
    detailTip: '手机距离嘴边约一拳半、略偏侧边可防气流直吹麦孔产生风噪；全程纯清音不带嗓音，保持细稳即可。',
    targetSec: 3,
    requiresVoiced: false,
  },
  {
    id: 'check_glide',
    name: '三四声软着陆短句测试',
    shortLabel: '短句托底',
    badge: '测语调托底',
    vowelHint: '用轻松口语朗读，三声微降即止、句尾轻轻收住不塌陷',
    focus: '体会三声轻落不压喉、句尾稳住不塌陷（评估语调起伏与托底线 160 Hz 达成率）',
    prompt: '今天天气真好，我们一起去公园散步吧。',
    detailTip: '用平时聊天般自然轻松的语速读完即可；遇到「好」「起」等三声字不必走完整深低谷，轻点一下顺势接过去，句尾轻落不沉嗓。',
    targetSec: 5,
    requiresVoiced: true,
  },
];

export const BUILTIN_CATEGORIES = [
  { id: 'micro', label: '微行为', builtin: true },
  { id: 'phonetics', label: '语音聚焦', builtin: true },
  { id: 'tone', label: '声调练习', builtin: true },
  { id: 'greeting', label: '日常短句', builtin: true },
  { id: 'daily', label: '生活场景', builtin: true },
  { id: 'story', label: '故事读本', builtin: true },
  { id: 'custom', label: '我的素材', builtin: true },
];

export const CATEGORIES = BUILTIN_CATEGORIES;

export const BUILTIN_SETS = [
  {
    id: 'microbehaviours',
    name: '日常微行为浸润 (叹气·轻笑·应答)',
    category: 'micro',
    tags: ['轻柔起音'],
    desc: '高位轻叹、轻笑与日常短应答，建立轻松轻柔的开口习惯',
    tip: '微行为常不足 1 秒，建议在「自由照镜」里边发声边看实时曲线感受轻起音。',
    builtin: true,
    lines: [
      { cue: '高位轻叹', text: '呼…… ↘', note: '从舒适偏亮位置轻吐温热微风，不往喉底沉压' },
      { cue: '清爽轻笑', text: '呵呵～ ↗', note: '嘴角微展、喉深处放松，先带一丝气息再轻笑' },
      { cue: '前置轻笑', text: '嘻嘻…… ↗', note: '舌面前部轻贴近硬腭，带出清亮靠前的轻笑' },
      { cue: '柔和唤醒', text: '嗯呢～ ↗', note: '先微震鼻梁前脸再带出韵母，避免喉门硬起音' },
      { cue: '随声附和', text: '好呀～ ↗', note: '「好」字轻点即止，尾字「呀」柔和带起' },
      { cue: '亲切应答', text: '对呀～ ↘', note: '「对」从亮区温和滑落，不在末尾突然垮下' },
      { cue: '去声软降', text: '就是这个～ ↘', note: '把砸地的全降变成轻轻落地的浅降' },
      { cue: '去声释气', text: '去吧～ ↘', note: '保留清爽送气感，句尾自然淡出不收紧' }
    ]
  },
  {
    id: 'korean_drills',
    name: '前鼻音桥接与元音过渡 (m → i → a)',
    category: 'phonetics',
    tags: ['轻柔起音', '前腔共鸣'],
    desc: '以双唇闭合鼻音 /m/ 为锚点，顺畅带出高前元音 /i/ 与开口元音 /a/',
    tip: '闭唇哼鸣时双唇完全合拢，感觉上唇微微发麻后再滑向「咪」「妈」。',
    builtin: true,
    lines: [
      { cue: '闭唇前鼻音', text: 'm————', note: '双唇轻合、下颌放松，不张口发成「嗯」' },
      { cue: '鼻音带出高前元音', text: 'm——咪——，m——咪——', note: '从闭唇 /m/ 直接滑入「咪」，留住前脸亮感' },
      { cue: '前鼻亮音接开口', text: '咪——妈——，咪——妈——', note: '「咪」保持前腔高点，「妈」只轻轻放开下颌' },
      { cue: '三步阶梯过渡', text: 'm — 衣 — 啊', note: '用同一条前口腔通道连贯滑过去' },
      { cue: '轻音阶上行', text: '咪 ↗   咪 ↗   咪——', note: '一层一层轻柔走高站稳，音量不必加大' },
      { cue: '温柔音高滑梯', text: '呜—— ↗ 啊—— ↘', note: '从舒适位置平稳轻滑走高，再轻柔回落' }
    ]
  },
  {
    id: 'fricatives_vot',
    name: '送气清爽与三套擦音分离',
    category: 'phonetics',
    tags: ['前腔共鸣', '气息控制'],
    desc: '练习平舌 z/c/s、舌面 j/q/x 与 zh/ch/sh（舌叶微贴不后缩）及轻柔送气',
    tip: '发 zh/ch/sh 时舌叶前缘轻贴齿龈后即可，避免舌头大幅后卷拉暗共鸣。',
    builtin: true,
    lines: [
      { cue: '双唇轻送气 (p/b)', text: '怕、白、漂亮、朋友', note: '前唇轻送细气即可，不重爆破' },
      { cue: '舌尖轻送气 (t/d)', text: '太、甜、听到、天气', note: '舌尖轻点上齿龈后立即轻巧弹开' },
      { cue: '舌根轻送气 (k/g)', text: '开心、咖啡、看见', note: '保持前腔亮感，不借势往喉深处用力' },
      { cue: '平舌前移 (z/c/s)', text: '早晨、散步、四季', note: '气流集中在上下门牙缝隙间，清晰细亮' },
      { cue: '舌面前贴 (j/q/x)', text: '今天、清晨、喜欢', note: '嘴角微展、舌面前部靠向硬腭' },
      { cue: '三套擦音串联', text: '四十细丝，清晨散步' }
    ]
  },
  {
    id: 'back_nasal_ng',
    name: '后鼻音 (-ng) 前置防塌陷',
    category: 'phonetics',
    tags: ['前腔共鸣'],
    desc: '练习 ang/eng/ing/ong 归音时守住前腔亮度，防止一碰 -ng 就沉入喉底',
    tip: '后鼻音只需软腭轻落，先把前元音留亮，尾音 -ng 轻轻“贴”上去就好。',
    builtin: true,
    lines: [
      { cue: '-ing 前鼻高点', text: '清明、星星、听听' },
      { cue: '-ang 开口稳亮', text: '阳光、糖果、亮堂' },
      { cue: '-eng 轻柔衔接', text: '风铃、梦想、朋友' },
      { cue: '-ong 聚拢不沉', text: '红茶、冬天、轻松' },
      { cue: '短句串联', text: '今天阳光很清爽，一起去逛逛吧。' }
    ]
  },
  {
    id: 'acoustic_drills',
    name: '共鸣 · 轻重 · 气息三维校验句',
    category: 'phonetics',
    tags: ['前腔共鸣', '气息控制'],
    desc: '覆盖前腔共鸣、柔和闭合与清擦音支撑的均衡测试短句',
    tip: '用约四五成轻柔聊天音量读：前 3 句看前腔亮度，中 3 句体会柔和闭合，后 3 句感受气流稳匀。',
    builtin: true,
    lines: [
      { cue: '前腔共鸣', text: '星星在静谧的夜里，依依不舍。' },
      { cue: '前腔共鸣', text: '清新的空气里，弥漫着细细的雨丝。' },
      { cue: '前腔共鸣', text: '今天天气特别晴朗，心情格外明丽。' },
      { cue: '柔和闭合', text: '温暖的阳光，缓缓照耀在原野上。' },
      { cue: '柔和闭合', text: '慢慢地呼出一口气，感觉整个人都放松了。' },
      { cue: '柔和闭合', text: '蓝天和白云，陪伴着每一个安宁的早晨。' },
      { cue: '纯净气流', text: '丝丝细雨，轻轻拂过山川与树林。' },
      { cue: '纯净气流', text: '顺其自然，轻松地呼吸，静静地倾听。' },
      { cue: '纯净气流', text: '微风穿过深蓝色的夜空，带来一丝凉爽。' }
    ]
  },
  {
    id: 'softtones',
    name: '声调滑翔与软着陆 (四声阶梯)',
    category: 'tone',
    tags: ['声调托底'],
    desc: '练习阴平稳托、半上声 (211) 与浅去声 (53/52)，减少连读掉音',
    tip: '连读时三声多走“前半截微落”（半上声），不用每个三声都拐到最低点。',
    builtin: true,
    lines: [
      { cue: '阴平 (55-55)', text: '今天、春天、分清、依稀', note: '高平声调最安稳，先站稳轻松的起点位置' },
      { cue: '阴阳 (55-35)', text: '资源、鲜明、飘扬、光芒', note: '前字平稳、后字顺势上扬' },
      { cue: '半上声 (三声+高音)', text: '美丽、雨滴、海洋', note: '前字三声轻落即止，顺势托起后字' },
      { cue: '双音日常词', text: '温暖、早安、喜欢' },
      { cue: '三声+轻声', text: '抹茶、晚风、奶茶' },
      { cue: '浅去声 (53/52)', text: '就是、见面、灿烂', note: '起音轻柔落向中间高度即可，不砸向底线' },
      { cue: '四声短词', text: '去吧、是的、月亮' },
      { cue: '短句托底', text: '今天天气真好，我们一起去公园散步吧。' }
    ]
  },
  {
    id: 'particles',
    name: '语气助词与句尾走势对比',
    category: 'tone',
    tags: ['声调托底'],
    desc: '区分疑问/友好助词的句末轻扬 (↗) 与陈述句的自然微降 (↘)',
    tip: '普通话陈述句本就自带轻微下降走势，只在疑问或亲切呼应处自然轻扬即可。',
    builtin: true,
    lines: [
      { cue: '疑问轻扬', text: '是这样吗？ ↗' },
      { cue: '感叹微扬', text: '今天天气真好呀～ ↗' },
      { cue: '分享呼应', text: '这个我也很喜欢呢！ ↗' },
      { cue: '干脆陈述', text: '那就这么说定啦～ ↘' },
      { cue: '安抚陈述', text: '对呀，慢慢来就好嘛 ↘' },
      { cue: '开心迎候', text: '好开心看到你呀！ ↗' }
    ]
  },
  {
    id: 'daily',
    name: '日常寒暄与短句',
    category: 'greeting',
    tags: ['生活对话'],
    desc: '常用生活问候与回应，用平时说话的感觉轻松开口',
    tip: '开口前先在心里轻找一个轻松点位，顺畅带出前两个字即可。',
    builtin: true,
    lines: [
      '你好呀～',
      '吃过饭了吗？',
      '今天天气怎么样？',
      '周末打算去哪里玩呀？',
      '请问洗手间是在左边吗？',
      '麻烦你等我一下哦。',
      '谢谢你，辛苦啦～',
      '今天先到这里，晚安～'
    ]
  },
  {
    id: 'cafe',
    name: '餐厅与点单',
    category: 'daily',
    tags: ['生活对话'],
    desc: '柜台点单与店员互动，练习自然清楚的日常表达',
    builtin: true,
    lines: [
      '你好，我想点一杯热拿铁。',
      '请问有燕麦奶吗？',
      '半糖就可以啦，麻烦帮我做温热的，谢谢哦～',
      '常温就好，不用加糖，谢谢。',
      '麻烦帮我打包带走，辛苦啦～',
      '请问可以帮我加一点温水吗？',
      '好的，我扫这个二维码。'
    ]
  },
  {
    id: 'work',
    name: '职场与通话',
    category: 'daily',
    tags: ['生活对话'],
    desc: '电话接听与工作沟通，无画面辅助时稳住开口位置',
    tip: '接电话第一句先用轻巧的「喂，您好」稳住亮位置。',
    builtin: true,
    lines: [
      '喂，您好，请问是哪位？',
      '不好意思，刚刚信号有点弱。',
      '这个方案我们已经确认过了。',
      '我稍后发到您的邮箱里。',
      '麻烦您了，祝您工作顺利～'
    ]
  },
  {
    id: 'work_briefing',
    name: '职场晨会与项目汇报',
    category: 'daily',
    tags: ['生活对话', '声调托底'],
    desc: '训练连续职场发言的平稳节奏与陈述收尾',
    tip: '按平时从容汇报的语速顺着读即可，句尾自然微落。',
    builtin: true,
    lines: [
      '大家早上好，今天向大家简要同步一下本周的两个项目进度。',
      '第一项，前端组件的优化已经基本完成了，核心页面的渲染非常稳定。',
      '第二项，配套文案与指南也已归档完毕，随时可以提交审核。',
      '整体排期符合预期，稍后我会把详细清单同步在群里。',
      '如果有需要调整的地方，欢迎大家随时告诉我，谢谢大家。'
    ]
  },
  {
    id: 'delivery_life',
    name: '外卖、快递与问路',
    category: 'daily',
    tags: ['生活对话'],
    desc: '高频突发电话与门口应答，练成不用多想的条件反射',
    builtin: true,
    lines: [
      '喂，您好！在家的～',
      '喂，你好，放门口就好，谢谢。',
      '放在门口的鞋柜上就可以啦，麻烦您了，辛苦啦～',
      '好的，放到快递柜就行，拜拜～',
      '对，是我点的，尾号是四六八。',
      '门已经开了，您可以直接进来。',
      '不好意思，请问地铁站往这边走吗？'
    ]
  },
  {
    id: 'story_north_wind',
    name: '《北风与太阳》（全音素平衡篇）',
    category: 'story',
    tags: ['长段故事'],
    desc: 'IPA 标准测试文本现代温和版，适合 60~90 秒综合语流体检',
    tip: '用平时讲故事的轻柔音量连读即可。',
    builtin: true,
    lines: [
      '有一次，北风和太阳正在争论，到底谁的本领比较大。',
      '就在这个时候，他们看见走来了一位旅客，身上裹着一件暖和的外套。',
      '他们便约定好，谁先有办法让这位旅客脱下外套，谁就算更有本领。',
      '北风先开始用力吹起来，他吹得呼呼作响，寒冷刺骨。',
      '可是，他吹得越使劲，那位旅客把外套裹得越紧。',
      '最后，北风觉得没有办法，只好无奈地放弃了。',
      '接着，太阳微笑着探出了云层，把温暖的阳光柔和地洒向大地。',
      '微风渐渐变得舒缓而明亮，整个原野都沐浴在柔和的光芒中。',
      '没过多久，旅客就感到身上暖洋洋的，他擦了擦汗，轻松地脱下了外套。',
      '北风看到这一切，终于心服口服，承认在温和的光芒面前，蛮力是无法取胜的。'
    ]
  },
  {
    id: 'story_forest_morning',
    name: '《林间晨光与微风》（治愈系语流篇）',
    category: 'story',
    tags: ['长段故事', '气息控制'],
    desc: '柔和开元音与鼻韵母连读短篇，适合放松紧绷、找回流畅语感',
    tip: '像轻声读睡前小故事一样，顺着标点自然呼吸即可。',
    builtin: true,
    lines: [
      '清晨的第一缕晨光，穿过了茂密的林叶，悄悄落在静静流淌的小溪上。',
      '微风拂过水面，带起了一圈圈细小而透明的涟漪。',
      '空气里带着泥土的清香，还有树叶上刚刚凝结出的露珠。',
      '林子里渐渐苏醒过来，远处的枝头上，传来几声清脆而欢快的小鸟啼鸣。',
      '每一声都轻盈地在空气中跳跃，像是一首温柔的迎晨曲。',
      '我们踩在松软的小路上，慢慢地向前走着。',
      '步子放得很轻，心情也变得格外安详与宁静。',
      '不用着急赶路，只是任由温和的阳光披在肩头。',
      '深深地吸一口清新湿润的空气，然后，缓缓地呼出胸中的所有疲惫。',
      '生活就是这样，只要顺着自然的节奏前行，每一步都会是崭新的希望。'
    ]
  }
];

const STORE_KEY = 'tv.sets.custom';
const ACTIVE_SET_KEY = 'tv.sets.active';
const CATS_KEY = 'tv.sets.categories';
const META_KEY = 'tv.sets.meta';

function readJson(key, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略容量受限异常
  }
}

function normalizeTags(rawTags) {
  const list = Array.isArray(rawTags)
    ? rawTags
    : (typeof rawTags === 'string' ? rawTags.split(/[,，、\s]+/) : []);
  const out = [];
  for (const item of list) {
    const t = String(item || '').trim().slice(0, 16);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

function loadCustomCategories() {
  const raw = readJson(CATS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c.id === 'string' && typeof c.label === 'string' && c.label.trim())
    .map((c) => ({ id: c.id, label: c.label.trim(), builtin: false }));
}

function saveCustomCategories(cats) {
  writeJson(CATS_KEY, cats);
}

function loadMetaMap() {
  const raw = readJson(META_KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function saveMetaMap(map) {
  writeJson(META_KEY, map);
}

const LEGACY_CATEGORY_MAP = {
  drill: 'phonetics',
};

function validCategoryId(catId, allCats) {
  const mapped = LEGACY_CATEGORY_MAP[catId] || catId;
  const cats = allCats || LibraryStore.getAllCategories();
  return cats.some((c) => c.id === mapped) ? mapped : 'custom';
}

export const LibraryStore = {
  getActiveSetId() {
    if (typeof localStorage === 'undefined') return 'daily';
    try {
      return localStorage.getItem(ACTIVE_SET_KEY) || 'daily';
    } catch {
      return 'daily';
    }
  },

  setActiveSetId(id) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(ACTIVE_SET_KEY, id);
    } catch {}
  },

  getAllCategories() {
    return [...BUILTIN_CATEGORIES, ...loadCustomCategories()];
  },

  addCustomCategory(label) {
    const clean = String(label || '').trim().slice(0, 16);
    if (!clean) return null;
    const all = this.getAllCategories();
    const existing = all.find((c) => c.label === clean);
    if (existing) return existing;
    const cats = loadCustomCategories();
    const created = {
      id: `cat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
      label: clean,
      builtin: false,
    };
    cats.push(created);
    saveCustomCategories(cats);
    return created;
  },

  removeCustomCategory(catId) {
    if (!catId || BUILTIN_CATEGORIES.some((c) => c.id === catId)) return false;
    const cats = loadCustomCategories();
    const nextCats = cats.filter((c) => c.id !== catId);
    if (nextCats.length === cats.length) return false;
    saveCustomCategories(nextCats);

    // 将原属该分类的素材柔和归位至「我的素材」，避免素材丢失或变成无分类
    const customSets = this.loadCustomSets().map((s) => (
      s.category === catId ? { ...s, category: 'custom' } : s
    ));
    this.saveCustomSets(customSets);

    const meta = loadMetaMap();
    let changed = false;
    for (const [sid, patch] of Object.entries(meta)) {
      if (patch && patch.category === catId) {
        meta[sid] = { ...patch, category: 'custom' };
        changed = true;
      }
    }
    if (changed) saveMetaMap(meta);
    return true;
  },

  loadCustomSets() {
    const arr = readJson(STORE_KEY, []);
    if (!Array.isArray(arr)) return [];
    const cats = this.getAllCategories();
    return arr.map((s) => ({
      ...s,
      builtin: false,
      category: validCategoryId(s.category || 'custom', cats),
      tags: normalizeTags(s.tags),
      lines: Array.isArray(s.lines) ? s.lines : [],
    }));
  },

  saveCustomSets(sets) {
    writeJson(STORE_KEY, sets);
  },

  getAllSets() {
    const cats = this.getAllCategories();
    const meta = loadMetaMap();
    const builtins = BUILTIN_SETS.map((s) => {
      const ov = meta[s.id];
      return {
        ...s,
        builtin: true,
        category: validCategoryId((ov && ov.category) || s.category, cats),
        tags: ov && Array.isArray(ov.tags) ? normalizeTags(ov.tags) : normalizeTags(s.tags),
      };
    });
    return [...builtins, ...this.loadCustomSets()];
  },

  getAllTags() {
    const set = new Set();
    for (const item of this.getAllSets()) {
      for (const t of item.tags || []) set.add(t);
    }
    return [...set];
  },

  getSet(id) {
    const all = this.getAllSets();
    return all.find((s) => s.id === id) || all[0];
  },

  addCustomSet(nameOrOpts, linesArg = [], optsArg = {}) {
    const isObj = nameOrOpts && typeof nameOrOpts === 'object' && !Array.isArray(nameOrOpts);
    const name = isObj ? (nameOrOpts.name || '') : (nameOrOpts || '');
    const rawLines = isObj ? (nameOrOpts.lines || []) : linesArg;
    const opts = isObj ? nameOrOpts : (optsArg || {});

    const rawArr = Array.isArray(rawLines) ? rawLines : [];
    let tip = opts.tip ? String(opts.tip).trim() : '';
    const cleanLines = [];
    for (const item of rawArr) {
      if (item && typeof item === 'object') {
        const text = String(item.text || '').trim();
        if (text) cleanLines.push({ ...item, text });
        continue;
      }
      const s = String(item || '').trim();
      if (!s) continue;
      if (!tip && /^【跟练提示】[:：]?/.test(s)) {
        tip = s.replace(/^【跟练提示】[:：]?/, '').trim();
        continue;
      }
      cleanLines.push(s);
    }
    if (!cleanLines.length) return null;

    const sets = this.loadCustomSets();
    const allCats = this.getAllCategories();
    const newSet = {
      id: `c_${Date.now().toString(36)}`,
      name: String(name).trim() || `我的素材 ${sets.length + 1}`,
      category: validCategoryId(opts.category || 'custom', allCats),
      tags: normalizeTags(opts.tags),
      ...(tip ? { tip } : {}),
      builtin: false,
      lines: cleanLines,
    };
    sets.push(newSet);
    this.saveCustomSets(sets);
    return newSet;
  },

  updateSetMeta(setId, patch = {}) {
    if (!setId) return null;
    const allCats = this.getAllCategories();
    const customSets = this.loadCustomSets();
    const idx = customSets.findIndex((s) => s.id === setId);
    if (idx !== -1) {
      const prev = customSets[idx];
      const next = {
        ...prev,
        name: patch.name !== undefined ? (String(patch.name).trim() || prev.name) : prev.name,
        category: patch.category !== undefined ? validCategoryId(patch.category, allCats) : prev.category,
        tags: patch.tags !== undefined ? normalizeTags(patch.tags) : (prev.tags || []),
      };
      customSets[idx] = next;
      this.saveCustomSets(customSets);
      return next;
    }

    const builtin = BUILTIN_SETS.find((s) => s.id === setId);
    if (!builtin) return null;
    const meta = loadMetaMap();
    const prevOv = meta[setId] || {};
    meta[setId] = {
      ...prevOv,
      ...(patch.category !== undefined ? { category: validCategoryId(patch.category, allCats) } : {}),
      ...(patch.tags !== undefined ? { tags: normalizeTags(patch.tags) } : {}),
    };
    saveMetaMap(meta);
    return this.getSet(setId);
  },

  deleteCustomSet(id) {
    const sets = this.loadCustomSets().filter((s) => s.id !== id);
    this.saveCustomSets(sets);
    if (this.getActiveSetId() === id) this.setActiveSetId('daily');
  },

  parseText(rawText) {
    return String(rawText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }
};

export const getAllCategories = () => LibraryStore.getAllCategories();
export const addCustomCategory = (label) => LibraryStore.addCustomCategory(label);
export const removeCustomCategory = (catId) => LibraryStore.removeCustomCategory(catId);
export const updateSetMeta = (setId, patch) => LibraryStore.updateSetMeta(setId, patch);
