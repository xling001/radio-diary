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
    tags: ['叹气', '轻起音', '微行为'],
    desc: '高位轻叹、轻笑与日常短应答，建立轻松轻柔的开口习惯',
    tip: '微行为单次常不足 1 秒，长录音指标易受长度限制，建议主要在「自由照镜」的实时曲线里感受轻起音与前置共鸣。',
    builtin: true,
    lines: [
      { cue: '高位轻叹', text: '呼……↘', note: '从舒适中高音区轻柔吐出一股温热微风，不往喉底沉压' },
      { cue: '清爽轻笑', text: '呵呵～ ↗', note: '嘴角微展、面颊轻提，喉深处松开，先出一点气息再轻声笑' },
      { cue: '前置轻笑', text: '嘻嘻嘻…… ↗', note: '舌面前部轻贴近硬腭，带出清亮靠前的轻笑' },
      { cue: '柔和唤醒', text: '嗯呢～ ↗', note: '先微震鼻梁与前脸再轻轻带出韵母，避免喉门硬起音' },
      { cue: '随声附和', text: '好呀～ ↗', note: '「好」字轻落即止（半上声），尾字「呀」轻柔带起后渐弱' },
      { cue: '亲切应答', text: '对呀～ ↘', note: '「对」字从亮区温和滑落（53/52），不在末尾突然垮下去' },
      { cue: '思考过渡', text: '让我想想看哦…… ↘', note: '遇到三声「想」不使劲往下踩，音调像小波浪一样平缓过去' },
      { cue: '去声软降', text: '就是这个～ ↘', note: '把重重砸地的 51 全降变成羽毛落地的 53 浅降' },
      { cue: '去声释气', text: '去吧～ ↘', note: '发「去」时保留清爽送气感，句尾自然淡出不收紧' }
    ]
  },
  {
    id: 'korean_drills',
    name: '前鼻音桥接与元音过渡 (m → i → a)',
    category: 'phonetics',
    tags: ['闭唇哼鸣', '前口腔', '过渡'],
    desc: '以双唇闭合鼻音 /m/ 为锚点，顺畅带出高前元音 /i/ 与开口元音 /a/',
    tip: '闭唇哼鸣时嘴巴完全合拢，不要张口发成带韵母的「嗯(en)」；感觉前唇微微发麻后再滑向「咪」「妈」。纯无声拉伸动作请见「指南」页。',
    builtin: true,
    lines: [
      { cue: '闭唇前鼻音 (不张口)', text: 'm————', note: '双唇轻合、下颌放松，感受鼻梁和上唇微微发麻，不发成「嗯」' },
      { cue: '鼻音带出前高元音', text: 'm——咪—— ｜ m——咪——', note: '从闭唇 /m/ 直接滑入「咪」，舌面前部自然前移，留住前脸亮感' },
      { cue: '前鼻亮音接开口', text: '咪——妈—— ｜ 咪——妈——', note: '「咪」保持舌面高前，「妈」只轻轻放开下颌，不把共鸣退回喉咙' },
      { cue: '三步阶梯过渡', text: 'm —— 衣 —— 啊', note: '从 /m/ 到「衣」再到「啊」，用同一条前口腔通道连贯滑过去' },
      { cue: '轻音阶上行 (mi)', text: '咪 ↗ ｜ 咪 ↗ ｜ 咪——', note: '一层一层轻柔走高站稳，音量不必加大，喉部保持松弛' },
      { cue: '温柔音高滑梯', text: '呜—— ↗ 啊—— ↘', note: '从舒适位置平稳轻滑向偏高区，再像滑梯一样轻柔回落' }
    ]
  },
  {
    id: 'fricatives_vot',
    name: '送气清爽与三套擦音分离',
    category: 'phonetics',
    tags: ['擦音前置', '送气', '吐字清晰'],
    desc: '区分平舌 z/c/s、舌面 j/q/x 与 zh/ch/sh（舌叶微贴不卷舌后缩），练习轻柔送气',
    tip: '发 zh/ch/sh 时用舌叶前缘轻轻贴近齿龈后，不要把舌头大幅往后卷缩，以免拉暗口腔共鸣；送气音保持气流细稳，不喷麦不硬压。',
    builtin: true,
    lines: [
      { cue: '双唇轻送气 (p/b)', text: '怕｜白 ｜ 漂｜亮 ｜ 朋｜友 ↘', note: '发 p 时前唇轻送出一缕细气即可，不重爆破' },
      { cue: '舌尖轻送气 (t/d)', text: '太｜甜 ｜ 听｜到 ｜ 天｜气 ↘', note: '舌尖轻点上齿龈后立即轻巧弹开，保持轻盈' },
      { cue: '舌根轻送气 (k/g)', text: '开｜心 ｜ 咖｜啡 ｜ 看｜见 ↘', note: '发 k 时保持前腔亮感，别借势往喉深处用力' },
      { cue: '平舌前移 (z/c/s)', text: '早｜晨 ｜ 散｜步 ｜ 四｜季 ↘', note: '气流集中在上下门牙缝隙间，清晰细亮' },
      { cue: '舌面前贴 (j/q/x)', text: '今｜天 ｜ 清｜晨 ｜ 喜｜欢 ↘', note: '舌面前部贴近硬腭，嘴角微展最容易带出柔和亮色' },
      { cue: '三套擦音串联', text: '四｜十｜细｜丝 ｜ /换气/ 清｜晨｜散｜步 ↘', note: '注意「十」不卷舌后缩，与前后的平舌/舌面音保持在同一前腔位置' }
    ]
  },
  {
    id: 'back_nasal_ng',
    name: '后鼻音 (-ng) 前置防塌陷',
    category: 'phonetics',
    tags: ['后鼻音', '防暗沉', '鼻腔'],
    desc: '练习 ang/eng/ing/ong 归音时守住约 80% 前腔亮度，防止一碰 -ng 就掉进低喉腔',
    tip: '普通话后鼻音只是软腭轻落，不需要把整个舌根压低、往脖子深处唱；先把前元音留亮，尾音 -ng 轻轻“贴”上去就好。',
    builtin: true,
    lines: [
      { cue: 'ing 前鼻高点', text: '清｜明 ｜ 星｜星 ｜ 听｜听 ↘', note: '先守住高前 /i/ 的明亮感，尾音轻轻滑向软腭' },
      { cue: 'ang 开口稳亮', text: '阳｜光 ｜ 糖｜果 ｜ 亮｜堂 ↘', note: '「阳、光」口腔自然打开即可，不要越往后越厚重' },
      { cue: 'eng 轻柔衔接', text: '风｜铃 ｜ 梦｜想 ｜ 朋｜友 ↘', note: '中间元音不要发得太靠后，保持轻声与微气感' },
      { cue: 'ong 聚拢不沉', text: '红｜茶 ｜ 冬｜天 ｜ 轻｜松 ↘', note: '双唇微拢像喝温水，注意别把音高随圆唇一起拉低' },
      { cue: '短句串联防塌', text: '今｜天｜阳｜光｜很｜清｜爽，/换气/ 一｜起｜去｜逛｜逛｜吧 ↘', note: '整句一连串后鼻音字，始终留在前口腔轻松滑过' }
    ]
  },
  {
    id: 'acoustic_drills',
    name: '共鸣 · 轻重 · 气息三维校验句',
    category: 'phonetics',
    tags: ['三维校验', '语流共鸣', '轻柔和闭合'],
    desc: '覆盖前腔高 /i/ 共鸣、开放柔和声带闭合与高频清擦音支撑的音素平衡校验句',
    tip: '全句以约四五成的轻柔聊天音量读完即可：前 3 句重点观察前腔亮度（F2 / ΔF），中 3 句感受羽毛般轻柔闭合（H1-H2），后 3 句体会送气与清擦音的洁净稳定。',
    builtin: true,
    lines: [
      { cue: '前腔共鸣 · 清亮聚焦', text: '星｜星｜在｜静谧的夜里，/换气/ 依｜依｜不舍 ↘', note: '集中 /i/ 与 j/x 音素，舌面前部自然前引，照出前口腔微空间' },
      { cue: '前腔共鸣 · 展唇微空间', text: '清新的｜空气里，/换气/ 弥漫着｜细细的｜雨丝 ↘', note: '「清、新、气、细、丝」一路保持嘴角微展，声道焦点不后退' },
      { cue: '前腔共鸣 · 自然语流', text: '今天天气｜特别晴朗，/换气/ 心情｜格外明丽 ↘', note: '用平稳语流串联前高元音，避免句中换气后音色变闷' },
      { cue: '柔和闭合 · 平稳气流', text: '温暖的｜阳光，/换气/ 缓缓照耀在｜原野上 ↘', note: '开元音 /a/ 配连续浊辅音，每个字音重均匀如风拂水面' },
      { cue: '柔和闭合 · 告别硬起音', text: '慢慢地｜呼出一口气，/换气/ 感觉｜整个人都｜放松了 ↘', note: '起音「慢」字前先留半丝温热微气，尾字「了」轻柔收束' },
      { cue: '柔和闭合 · 舒展弹性', text: '蓝天和｜白云，/换气/ 陪伴着｜每一个｜安宁的早晨 ↘', note: '三声字「每、早」做半上轻触即起，不往下压入低频沉音' },
      { cue: '纯净气流 · 高位擦音', text: '丝丝细雨，/换气/ 轻轻拂过｜山川与树林 ↘', note: 's/x/sh 清擦音保持前唇齿与舌叶前缘干净细腻，不卷舌后缩' },
      { cue: '纯净气流 · 气息托底', text: '顺其自然，/换气/ 轻松地呼吸，｜静静地｜倾听 ↘', note: '连续清辅音之间保持稳匀气流，避免发紧或突发断气' },
      { cue: '纯净气流 · 调位衔接', text: '微风｜穿过｜深蓝色的夜空，/换气/ 带来｜一丝凉爽 ↘', note: '从高位清平顺畅落回温柔尾音，吐字清澈无沙哑摩擦' }
    ]
  },
  {
    id: 'softtones',
    name: '声调滑翔与软着陆 (四声阶梯进阶)',
    category: 'tone',
    tags: ['声调滑翔', '半上声', '防下探'],
    desc: '从阴平稳托、阴阳顺扬过渡到半上声 (211) 与浅去声 (53/52)，防连读坠底',
    tip: '在连续说话里，三声字大多只走“前半截微落”（半上声）就接着往下滑，不需要每个三声都拐到最低点再翘起来。',
    builtin: true,
    lines: [
      { cue: '阴平稳托 (55-55)', text: '今｜天 ｜ 春｜天 ｜ 分｜清 ｜ 依｜稀', note: '高平声调最安稳，先在前口腔站稳轻松的起点位置' },
      { cue: '阴阳顺升 (55-35)', text: '资｜源 ｜ 鲜｜明 ｜ 飘｜扬 ｜ 光｜芒 ↗', note: '前字平稳、后字轻盈顺势上扬，体会音高流动不费力' },
      { cue: '三声＋轻高 (半上声)', text: '美｜丽 ｜ 雨｜滴 ｜ 海｜洋 ↘', note: '前字三声轻落即止，顺势托起后面的高音字' },
      { cue: '双音日常词汇', text: '温｜暖 ｜ 早｜安 ｜ 喜｜欢 ↘', note: '前字微降后立刻衔接后字，喉咙不额外下压' },
      { cue: '三声＋轻声', text: '抹｜茶 ｜ 晚｜风 ｜ 奶｜茶 ↘', note: '后字轻快柔和带过，像微风轻轻吹过去' },
      { cue: '四声浅降 (53/52)', text: '就｜是 ｜ 见｜面 ｜ 灿｜烂 ↘', note: '起音轻柔落向中间高度即可，不砸向底线' },
      { cue: '四声日常短词', text: '去｜吧 ｜ 是｜的 ｜ 月｜亮 ↘', note: '尾音留一点松弛气息，慢慢收住' },
      { cue: '混合短句连读', text: '今天｜天气｜真好，/换气/ 我们｜一起去｜公园｜散步吧 ↘', note: '前半句微留余韵，后半句顺势平缓落定，句尾不塌进底噪区' }
    ]
  },
  {
    id: 'particles',
    name: '语气助词与句尾走势对比',
    category: 'tone',
    tags: ['语气词', '陈述与疑问', '句尾衔接'],
    desc: '区分疑问句/友好助词的句末轻扬 (↗) 与普通陈述句的自然平缓微降 (↘)',
    tip: '普通话陈述句本就自带轻微下降走势，不必每句话都刻意往上翘成“升调”；只在疑问或表达亲切呼应的「呀/呢/吗」处自然轻扬即可。',
    builtin: true,
    lines: [
      { cue: '真疑问句 (自然轻扬)', text: '是｜这样｜吗？↗', note: '「吗」字跟着轻声自然微扬，温柔收尾不拔高刺耳' },
      { cue: '亲切感叹 (呀)', text: '今天｜天气｜真好｜呀～ ↗', note: '在「好」轻落之后借「呀」顺势温柔带起' },
      { cue: '分享呼应 (呢)', text: '这个｜我也｜很喜欢｜呢！↗', note: '把重音轻放在「很喜欢」，句尾「呢」柔和延续' },
      { cue: '干脆陈述 (啦)', text: '那就｜这么｜说定｜啦～ ↘', note: '友好约定后的舒缓平落，轻盈但不一定要往上拐' },
      { cue: '安抚陈述 (嘛)', text: '对呀，/换气/ 慢慢来｜就好｜嘛 ↘', note: '「对呀」轻落衔接，后半句平缓稳稳收住' },
      { cue: '开心迎候 (呀)', text: '好开心｜看到｜你呀！↗', note: '把笑容带进开口位置，气流顺畅不紧绷' }
    ]
  },
  {
    id: 'daily',
    name: '日常寒暄与短句',
    category: 'greeting',
    tags: ['寒暄', '日常短句', '高频'],
    desc: '最常用的生活问候与回应，练习在零准备状态下轻松开口',
    tip: '第一声通常决定整句话是否掉回去；开口前先在心里轻找一个轻松点位，再顺畅说出前两个字。',
    builtin: true,
    lines: [
      { cue: '打招呼', text: '你好｜呀～ ↗', note: '「你」走半上声不深坠，借「好呀」柔和扬起' },
      { cue: '日常问候', text: '吃过｜饭了｜吗？↗', note: '「饭」轻降不重砸，尾字「吗」轻扬收尾' },
      { cue: '天气闲聊', text: '今天｜天气｜怎么样？↗', note: '「今」稳住亮色，「怎么」轻快过渡' },
      { cue: '轻松提议', text: '周末｜打算｜去哪里｜玩呀？↗', note: '遇到三声「打、哪」轻点就过，保持句子连贯' },
      { cue: '礼貌询问', text: '请问｜洗手间｜是在｜左边吗？↗', note: '前两个字轻起音，重点字清晰但不加重喉压' },
      { cue: '请对方稍候', text: '麻烦你｜等我｜一下哦 ↘', note: '平稳柔和的陈述收尾，语气礼貌' },
      { cue: '表达感谢', text: '谢谢你，/换气/ 辛苦｜啦～ ↘', note: '「谢谢」柔和浅降，换一口小气再接「辛苦啦」' },
      { cue: '睡前告别', text: '今天｜先到｜这里，/换气/ 晚安～ ↘', note: '音调柔和偏轻，句尾羽毛落地般自然收声' }
    ]
  },
  {
    id: 'cafe',
    name: '餐厅与点单',
    category: 'daily',
    tags: ['场景', '点单'],
    desc: '柜台点单与店员互动，练习清晰吐字与温和轻起音',
    tip: '点单环境常有一点背景声，容易不自觉提高音量压实喉咙；试着用“把字送到前面、声带保持轻柔”的方式表达清楚。',
    builtin: true,
    lines: [
      { cue: '开场点单', text: '你好，/换气/ 我想点｜一杯｜热拿铁 ↘', note: '「你好」先占稳轻松高区，换半口气再报品名' },
      { cue: '询问替换', text: '请问｜有｜燕麦奶｜吗？↗', note: '「燕麦奶」三个字咬字前移，尾音「吗」轻扬' },
      { cue: '调整甜度温度', text: '半糖｜就可以啦，/换气/ 麻烦帮我｜做温热的，｜谢谢您哦～ ↗', note: '句末「哦」轻飘上扬，温柔亲切不沉底' },
      { cue: '确认口味', text: '常温｜就好，/换气/ 不用｜加糖，｜谢谢 ↘', note: '逗号处略作轻停，避免一口气说到后面音高下滑' },
      { cue: '打包请求', text: '麻烦｜帮我｜打包｜带走，｜辛苦啦～ ↘', note: '「打包」三声轻落即止，尾音助词轻柔飘出' },
      { cue: '加温水', text: '请问｜可以｜帮我加｜一点｜温水吗？↗', note: '中间词组连贯轻快，尾字温和上扬' },
      { cue: '结账扫码', text: '好的，/换气/ 我扫｜这个｜二维码 ↘', note: '「好的」轻快衔接，句尾稳定不压喉' }
    ]
  },
  {
    id: 'work',
    name: '职场与通话',
    category: 'daily',
    tags: ['职场', '电话'],
    desc: '电话接听与会议沟通，练习失去画面辅助时依然稳住前腔共鸣',
    tip: '接电话时很容易突然切换回惯性低音；拿起手机第一句先发轻巧的「喂，您好」，给自己一拍建立前腔锚点。',
    builtin: true,
    lines: [
      { cue: '接听第一句', text: '喂，｜您好，/换气/ 请问｜是｜哪位？↗', note: '「喂」轻柔偏亮起音，短停半拍稳住后再问候' },
      { cue: '信号说明', text: '不好意思，/换气/ 刚刚｜信号｜有点弱 ↘', note: '「不好意思」轻快带过，不压低语调' },
      { cue: '同步进度', text: '这个｜方案｜我们｜已经｜确认｜过了 ↘', note: '每个词组轻轻点到为止，避免重音全砸在句尾' },
      { cue: '约定后续', text: '我稍后｜发到｜您的｜邮箱里 ↘', note: '「里」字保持轻声前亮，不要垮到底部' },
      { cue: '礼貌挂断', text: '麻烦｜您了，/换气/ 祝您｜工作｜顺利～ ↘', note: '句末温和浅降收尾，保留清爽礼貌感' }
    ]
  },
  {
    id: 'work_briefing',
    name: '职场晨会与项目汇报',
    category: 'daily',
    tags: ['职场', '长段陈述', '会议'],
    desc: '训练 1 分钟左右连续职场发言时的节奏切分与平稳陈述收尾，防越说越急、气息滑落',
    tip: '职场汇报不必句句往上扬；遇到专业词或四声词保持前腔亮感，按照「/换气/」稳稳停顿换半口气再接着说，结尾平稳微降即可。',
    builtin: true,
    lines: [
      { cue: '晨会开场', text: '大家｜早上好。/换气/ 今天｜我向大家｜简要同步一下｜本周的两个项目进度 ↘', note: '「早上好」前两字温和点出，「好」轻收不硬压，换气后从容展开' },
      { cue: '进展汇报（一）', text: '第一项，｜前端组件的优化｜已经基本完成了，/换气/ 核心页面的渲染｜非常稳定 ↘', note: '长词组中间略作轻停，四声词「已、基、本」以浅降平稳过渡' },
      { cue: '进展汇报（二）', text: '第二项，｜配套的文案与指南｜也已归档完毕，/换气/ 随时可以｜提交团队交叉审核 ↘', note: '「指南、归档」三声轻落即起；句尾四声字「核、审」不砸嗓' },
      { cue: '排期确认', text: '整体排期｜符合预期，/换气/ 稍后我会把｜详细清单｜同步在群里 ↘', note: '保持轻柔均匀音量，遇到「详细、清单」别不自觉用力压重音' },
      { cue: '从容收束', text: '如果有需要调整的地方，/换气/ 欢迎大家｜随时告诉我，｜谢谢大家 ↘', note: '陈述句尾自然平缓浅降收住，保留清爽舒展的职业感' }
    ]
  },
  {
    id: 'delivery_life',
    name: '外卖、快递与问路',
    category: 'daily',
    tags: ['场景', '外卖', '高频防护'],
    desc: '突然响起的电话或门口对话最容易触发惯性掉音，通过固定模板形成肌肉记忆',
    tip: '在生活里，先把最常见的 3 秒回复练成不用动脑的条件反射，最能帮你在措手不及的瞬间稳住发声状态。电话窄带传输容易削弱高频，开口「喂」字可先略微展唇前移。',
    builtin: true,
    lines: [
      { cue: '展唇接听', text: '喂，｜您好！｜在家的～ ↗', note: '电话第一声「喂」嘴角微展、靠前轻柔滑起，建立高前锚点' },
      { cue: '外卖敲门/来电', text: '喂，｜你好 ↗ ｜ 放门口｜就好，｜谢谢 ↘', note: '「喂」轻起锚定音区，后半句轻快致谢' },
      { cue: '快递代收', text: '放在门口的｜鞋柜上｜就可以啦，/换气/ 麻烦您了，｜辛苦啦～ ↘', note: '「口、以」半上托底，后半句保持轻盈友善' },
      { cue: '轻快挂断', text: '好的，/换气/ 放到｜快递柜｜就行，｜拜拜～ ↘', note: '「拜」前字平稳偏亮、后字轻轻滑落，通透利落' },
      { cue: '确认外卖电话', text: '对，｜是我｜点的，/换气/ 尾号｜是｜四六八 ↘', note: '报数字时一字一顿保持在前腔，不突然沉下来' },
      { cue: '门禁开门', text: '门已经｜开了，/换气/ 您可以｜直接｜进来 ↘', note: '句中换气补足气息，避免后半句越来越弱' },
      { cue: '街头问路', text: '不好意思，/换气/ 请问｜地铁站｜往｜这边｜走吗？↗', note: '先用「不好意思」轻柔开启对话，再稳稳问清方向' }
    ]
  },
  {
    id: 'story_north_wind',
    name: '《北风与太阳》（全音素平衡篇）',
    category: 'story',
    tags: ['故事读本', '全音素平衡', '长段落'],
    desc: 'IPA 国际语音学标准测试文本现代温和版，覆盖普通话全部声母与主要韵母，适合做 60~90 秒综合语流体检',
    tip: '以约四五成温和讲述音量读完：可用下方「下一句」逐句打磨呼吸与声调，也可直接用「自由照镜」一口气连读整篇来测长语流稳定性。',
    builtin: true,
    lines: [
      { cue: '开篇定调', text: '有一次，/换气/ 北风｜和太阳｜正在争论，｜到底谁的本领｜比较大 ↘', note: '「到底、比较」三声轻落即过；「争论、大」四声温和浅降' },
      { cue: '人物出场', text: '就在这个时候，/换气/ 他们看见｜走来了一位旅客，｜身上裹着一件｜暖和的外套 ↘', note: '句中换气保持平缓；「暖和」的「和」轻读如羽毛落地' },
      { cue: '立下约定', text: '他们便约定好，/换气/ 谁先有办法｜让这位旅客｜脱下外套，｜谁就算更有本领 ↘', note: '「好、有、本」用半上声托在舒适底线上，不往下压沉' },
      { cue: '北风试探', text: '北风｜先开始用力吹起来，/换气/ 他吹得呼呼作响，｜寒冷刺骨 ↘', note: '遇到四声字「作、刺」提前留半丝微气缓冲，不硬撞声门' },
      { cue: '越吹越紧', text: '可是，/换气/ 他吹得越使劲，｜那位旅客｜把外套裹得越紧 ↘', note: '「可是」轻起，后半句均匀送气，不因连串重音而压喉' },
      { cue: '北风退场', text: '最后，/换气/ 北风｜觉得没有办法，｜只好无奈地｜放弃了 ↘', note: '「最后、办法、放弃」均走 53/52 浅降，「了」轻声柔和收住' },
      { cue: '太阳登场', text: '接着，/换气/ 太阳微笑着｜探出了云层，｜把温暖的阳光｜柔和地洒向大地 ↘', note: '嘴角微展带亮前腔，让「温暖、阳光、柔和」顺滑串联' },
      { cue: '微风与光芒', text: '微风｜渐渐变得舒缓而明亮，/换气/ 整个原野｜都沐浴在｜柔和的光芒中 ↘', note: '换气处略微放松下颌，整句音量维持轻柔均匀' },
      { cue: '脱下外套', text: '没过多久，/换气/ 旅客就感到｜身上暖洋洋的，/换气/ 他擦了擦汗，｜轻松地脱下了外套 ↘', note: '长句分两次轻换气，保持气息连贯，「了、的」轻快带过' },
      { cue: '温和收束', text: '北风看到这一切，/换气/ 终于心服口服，｜承认｜在温和的光芒面前，｜蛮力是无法取胜的 ↘', note: '以平缓舒展的陈述微降收尾，尾字不坠入低频胸声区' }
    ]
  },
  {
    id: 'story_forest_morning',
    name: '《林间晨光与微风》（治愈系语流篇）',
    category: 'story',
    tags: ['故事读本', '治愈语流', '呼吸节奏'],
    desc: '富含柔和开元音、前/后鼻韵母与连续轻声的治愈短篇，专为放松紧绷感与建立流畅说话语感设计',
    tip: '不用刻意拿捏字正腔圆，像对着身边的朋友轻声讲睡前故事一样，顺着「/换气/」符号自然呼吸即可。',
    builtin: true,
    lines: [
      { cue: '柔和开篇', text: '清晨的第一缕晨光，/换气/ 穿过了茂密的林叶，｜悄悄落在｜静静流淌的小溪上 ↘', note: '「清晨、穿过」轻柔起音，后鼻音「光、静、淌」留住前腔亮感' },
      { cue: '水面涟漪', text: '微风拂过水面，/换气/ 带起了一圈圈｜细小而透明的涟漪 ↘', note: '「微风、水面」气息连贯，「细小、透明」吐字轻盈清晰' },
      { cue: '晨露清香', text: '空气里｜带着泥土的清香，/换气/ 还有树叶上｜刚刚凝结出的露珠 ↘', note: '「空气、树叶」去声浅降不重砸，「里、上」自然轻读滑过' },
      { cue: '林间鸟鸣', text: '林子里｜渐渐苏醒过来，/换气/ 远处的枝头上，｜传来几声清脆而欢快的｜小鸟啼鸣 ↘', note: '遇到三声「里、醒、小、鸟」用半上声轻轻点水掠过' },
      { cue: '迎晨之歌', text: '每一声｜都轻盈地在空气中跳跃，/换气/ 像是一首｜温柔的迎晨曲 ↘', note: '「跳跃、曲」保持轻柔气流支撑，语调自然起伏不尖锐' },
      { cue: '松软小路', text: '我们踩在｜松软的小路上，/换气/ 慢慢地向前走着 ↘', note: '「踩在、小路、慢慢」均以轻柔声带边缘接字，句尾轻收' },
      { cue: '安详步伐', text: '步子放得很轻，/换气/ 心情也变得｜格外安详与宁静 ↘', note: '「变得、安详、宁静」保持前脸微展，防止后半句气息塌陷' },
      { cue: '阳光披肩', text: '不用着急赶路，/换气/ 只是任由温和的阳光｜披在肩头 ↘', note: '「赶路」前字半上托底，「温和、阳光」柔和舒展' },
      { cue: '呼吸释放', text: '深深地吸一口｜清新湿润的空气，/换气/ 然后，｜缓缓地呼出｜胸中的所有疲惫 ↘', note: '借「/换气/」真的做一次轻松吐气，顺势松开下颌与肩颈' },
      { cue: '温和结尾', text: '生活就是这样，/换气/ 只要顺着自然的节奏前行，｜每一步都会是｜崭新的希望 ↘', note: '最后四字平稳亮朗收束，像温柔讲完一个睡前小故事' }
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
