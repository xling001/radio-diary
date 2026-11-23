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
  { id: 'literature', label: '文学少女', builtin: true },
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
  // ── 【日常短句】新增 5 组 ──────────────────────────────────────────
  {
    id: 'morning_mumble',
    name: '早起与居家碎碎念',
    category: 'greeting',
    tags: ['生活对话', '轻柔起音'],
    desc: '起床、挑衣服、喝温水与出门前的自言自语，适合每天早起轻松开嗓',
    tip: '像一个人在家小声嘀咕一样轻松开口，不用刻意抬高音量。',
    builtin: true,
    lines: [
      '唔，今天怎么起得这么早呀。',
      '先去倒一杯温水喝，喉咙还有点干。',
      '看看今天天气预报，好像下午会起风。',
      '那还是搭一件薄外套出门吧，冷了不好受。',
      '哎，我的钥匙刚才明明放在桌上的呀。',
      '找到了，原来被包包压在底下了。',
      '手机电量满格，耳机也带好了，不错不错。',
      '照一下镜子，嗯，今天状态看着还挺精神的。',
      '先把窗户关小一点，免得一会儿下雨飘进来。',
      '好啦，深吸一口气，准备出门迎接今天吧～'
    ]
  },
  {
    id: 'wechat_voice',
    name: '微信语音与线上开麦',
    category: 'greeting',
    tags: ['生活对话', '轻柔起音'],
    desc: '微信语音条、朋友连麦与游戏开麦高频短句，练顺开头两字的自然起音',
    tip: '按住说话前先轻轻换半口气，开头两个字带一点轻柔气息会更自然。',
    builtin: true,
    lines: [
      '哈喽哈喽，能听见我说话吗？',
      '不好意思呀，我刚才在忙，现在给你回条语音。',
      '我刚看完你发的消息，笑死我了，真的假的呀？',
      '等我一下下，我拿个耳机，马上就回来哦。',
      '这边这边，小心你后面有人过来啦！',
      '哇这波配合好丝滑，太厉害了吧～',
      '刚刚网络卡了一下，你那句话我没听清，能再说一遍吗？',
      '没问题没问题，我一会儿到家就发给你。',
      '好啦，时间也不早了，那我先下麦休息啦。',
      '拜拜～明天有空再一起连麦玩呀！'
    ]
  },
  {
    id: 'gentle_no',
    name: '温柔说“不”与礼貌拒绝',
    category: 'greeting',
    tags: ['生活对话', '自我边界'],
    desc: '婉拒推销、推掉邀约与守住日常小边界，练习语气平静而不压嗓',
    tip: '拒绝别人时容易不自觉把声音压低变硬，试着保持平缓轻稳的语气说完就好。',
    builtin: true,
    lines: [
      '不用啦谢谢，我先随便看看就好。',
      '不好意思呀，办卡的话我暂时不太需要呢。',
      '今天真的有点累了，我先回家休息，下次再约你吧～',
      '谢谢你的好意，不过这个我不太习惯，还是算啦。',
      '不好意思，我手头还有点事没处理完，可能帮不上忙了。',
      '这个口味我平时不太吃，我们换一家试试怎么样？',
      '谢谢关心呀，不过我自己心里有数，慢慢来就好。',
      '不好意思，这个属于私人问题，我不太方便回答哦。',
      '没事的，我先忙自己的啦，祝你今天顺利。'
    ]
  },
  {
    id: 'happy_share',
    name: '夸奖别人与分享小开心',
    category: 'greeting',
    tags: ['生活对话', '前腔共鸣'],
    desc: '带着轻微笑意夸人和分享生活小确幸，自然打开明亮的前腔共鸣',
    tip: '读的时候嘴角可以轻轻带一点笑意，声音不用大，也会自然透出清亮感。',
    builtin: true,
    lines: [
      '哇，你今天这件外套的颜色也太衬肤色了吧！',
      '你这个发型剪得真好看，显得整个人好温柔呀。',
      '快尝尝这个，居然一点都不甜腻，好好吃哎～',
      '我刚刚在路边碰到一只圆滚滚的小橘猫，它还蹭我裤脚了！',
      '今天的晚霞怎么这么粉呀，快抬头看看天空。',
      '听你这么一说，我心情一下子轻松好多呢。',
      '这家小店放的歌好舒服，下次我们还来这里坐坐吧。',
      '谢谢你一直记得我喜欢喝热牛奶，好暖心呀～',
      '今天的风吹在脸上软软的，真想多散一会儿步。',
      '能遇到这些细碎的小开心，今天就已经很值得啦。'
    ]
  },
  {
    id: 'daily_apology_help',
    name: '借过、道歉与小求助',
    category: 'greeting',
    tags: ['生活对话'],
    desc: '地铁借过、迟到致歉与请人帮忙等日常微尴尬瞬间，练出大方松弛的语感',
    tip: '遇到突发小状况时先放慢半拍语速，吐字清楚比急着说完更显从容。',
    builtin: true,
    lines: [
      '不好意思，麻烦借过一下，谢谢～',
      '哎呀抱歉抱歉，路上有点堵车，让你久等啦！',
      '打扰一下，可以麻烦你帮我们拍张合照吗？',
      '不好意思，刚才不小心碰到你了，没事吧？',
      '请问这班车是开往市中心方向的吗？',
      '哎呀是我看错排号了，真不好意思，您先请。',
      '麻烦帮我扶一下电梯门，谢谢你呀！',
      '刚才忘记说不要香菜了，请问现在还来得及改吗？',
      '太感谢你帮忙啦，真是帮了我大忙～'
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
  // ── 【生活场景】新增 4 组 ──────────────────────────────────────────
  {
    id: 'commute_shop',
    name: '打车、便利店与取快递',
    category: 'daily',
    tags: ['生活对话'],
    desc: '网约车、便利店结账与菜鸟驿站等高频陌生人短对话，练成自然条件反射',
    tip: '都是平时每天会碰到的真实短句，用清晰礼貌的日常语速顺着说即可。',
    builtin: true,
    lines: [
      '师傅你好，手机尾号是三七八九。',
      '麻烦帮我开一下后备箱，有个小箱子，谢谢师傅。',
      '前面路口过了红绿灯，靠边停一下就行啦，辛苦啦～',
      '你好，这个饭团麻烦帮我微波加热一下，谢谢。',
      '不用塑料袋啦，我自己带了帆布包。',
      '关东煮我要一根萝卜、两串鱼豆腐，再加一点热汤就好。',
      '好的，微信支付，我扫这边的付款码。',
      '你好，我取一下快递，取件码是五杠二杠幺零四。',
      '还有一个小件应该在旁边货架，我顺手一起拿了哦。',
      '对，都扫完出库啦，谢谢，拜拜～'
    ]
  },
  {
    id: 'salon_shopping',
    name: '理发、试衣与日常逛街',
    category: 'daily',
    tags: ['生活对话'],
    desc: '在理发店沟通发尾刘海、服装店问尺码与美妆店试色，练习从容表达审美需求',
    tip: '表达自己想要的细节时语速可以稍慢一点，尾音平稳收住，听起来既温柔又有主见。',
    builtin: true,
    lines: [
      '你好，我想稍微修一下分叉的发尾，整体长度尽量帮我留着哦。',
      '刘海稍微打薄一点点就好，不要剪得太短，平时习惯侧分。',
      '洗头的水温刚刚好，力道也很舒服，谢谢。',
      '吹干的时候发尾稍微往里带一点弧度就可以，不用太卷。',
      '你好，请问架子上这件浅米色针织衫还有 M 码吗？',
      '我想进试衣间试穿一下这两件，请问试衣间是在最里面吗？',
      '这件版型挺合身的，就是袖子稍微长了一点，我再考虑看看。',
      '你好，请问这支奶茶色的口红可以帮我拿一只试用装看看吗？',
      '嗯，涂在手背上挺显温柔的，很适合日常通勤。',
      '那我就拿这支新的吧，麻烦帮我开单，谢谢你呀～'
    ]
  },
  {
    id: 'service_hospital',
    name: '客服电话、医院挂号与窗口办事',
    category: 'daily',
    tags: ['生活对话', '声调托底'],
    desc: '无画面辅助的电话客服、医院就诊与办事窗口沟通，稳住开口与清晰吐字',
    tip: '在较正式或隔着电话的场合，先轻稳托住第一句，吐字舒展不急促。',
    builtin: true,
    lines: [
      '您好，麻烦帮我转一下人工客服，谢谢。',
      '您好，我查一下前天下的那个订单，物流已经两天没有更新了。',
      '对，收件人姓林，地址没有填错，麻烦帮我催促一下派送。',
      '好的，那我就先等您的回电，辛苦帮我登记一下，谢谢。',
      '你好，我在公众号上挂了今天下午的普通号，请问是在二楼刷卡报到吗？',
      '医生您好，我这两天有点咽干咳嗽，晚上稍微明显一点，没有发烧。',
      '好的，那这个药是饭后温水吃，一天两次对吧？',
      '你好，我来办理一下业务，身份证和复印件都带齐了，给您。',
      '请问办完之后，回执单是在旁边三号窗口领取吗？',
      '明白啦，谢谢您耐心解答，祝您工作顺利。'
    ]
  },
  {
    id: 'misgender_calm',
    name: '被误称与边界的从容应对',
    category: 'daily',
    tags: ['生活对话', '自我边界'],
    desc: '面对电话误称、声音疑惑或越界追问时的分级从容回应，提前在安全环境里练顺口',
    tip: '安全与好心情永远第一位！觉得累或环境不安全时，直接忽略或简短结束对话完全没问题；只在你感到安全、也愿意开口时，挑一句最顺手的平静说出就好。',
    builtin: true,
    lines: [
      { cue: '电话自然纠偏', text: '哦，我姓林，是女士哦，麻烦帮我改一下备注吧～' },
      { cue: '电话轻松确认', text: '对的，就是我本人，我是女生，可能刚才信号有点糊。' },
      { cue: '当面大方纠正', text: '不好意思哦，叫我林女士或者小姐姐就行啦。' },
      { cue: '平淡笃定回应', text: '嗯，我是女生呀，怎么了？' },
      { cue: '过渡期轻松带过', text: '哈哈，天生低音炮，从小就是这副嗓子啦～' },
      { cue: '临时挡箭牌', text: '这两天有点熬夜着凉，嗓子哑得厉害，见谅呀。' },
      { cue: '温柔拉回正题', text: '不好意思，这个问题和咱们要办的事好像没关系哦，我们直接看下一步吧。' },
      { cue: '礼貌拒绝追问', text: '我不太习惯和陌生人聊私人问题呢，谢谢你的理解。' },
      { cue: '平和止损结束', text: '谢谢关心，不过这个我就不多解释啦，先忙自己的了。' },
      { cue: '不消耗礼貌收尾', text: '嗯，放门口就好，谢谢您，再见。' }
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
  },
  // ── 【故事读本】新增 6 篇（4 篇轻寓言 + 2 篇安静慢散文） ──────────────────
  {
    id: 'story_cat_cloud',
    name: '《执着晒太阳的橘猫与云》',
    category: 'story',
    tags: ['长段故事'],
    desc: '一只懒散橘猫和一朵闲云的午后拉锯战，轻松好读、自带一点俏皮感',
    tip: '像给朋友讲一个无聊小笑话一样，语调可以带一点轻快和笑意。',
    builtin: true,
    lines: [
      '院子里住着一只很胖的橘猫，它每天唯一的正经工作，就是晒太阳。',
      '下午两点，水泥地上正好亮起一块方方正正的暖黄色阳光。',
      '橘猫慢悠悠走过去，转了两圈，心满意足地把自己摊成了一张大饼。',
      '偏偏天上飘来一朵同样很无聊的白云，慢吞吞地停在了太阳前面。',
      '院子里的阳光啪地一下消失了，橘猫眯开一只眼睛，无奈地叹了口气。',
      '它勉强爬起来，往前挪了三步，重新找回了一小块亮堂堂的光斑。',
      '天上的白云觉得这游戏挺有意思，又晃晃悠悠地往前飘了三步。',
      '于是，一只猫和一朵云就在院子里你走一步、我跟一步，认真僵持了一整个下午。',
      '橘猫从东边的花盆挪到了西边的晾衣架，又从晾衣架挪回了家门口的台阶。',
      '等到太阳终于落山的时候，白云满意地飘走了，橘猫也累得直打哈欠。',
      '不过它低头算了算，今天不知不觉绕着院子走了整整一大圈，运动量居然达标了。',
      '橘猫顿时觉得自己非常自律，心安理得地摇着尾巴去吃双倍晚饭了。'
    ]
  },
  {
    id: 'story_early_owl',
    name: '《决定今天早睡的猫头鹰》',
    category: 'story',
    tags: ['长段故事'],
    desc: '一只立志八点入睡的猫头鹰，如何在失眠中悟出“早睡”新定义',
    tip: '读到最后一句小反转时可以稍微放轻、带一点忍俊不禁的语调。',
    builtin: true,
    lines: [
      '森林里有一只猫头鹰，前几天听喜鹊说，早睡早起身体才会特别好。',
      '它觉得很有道理，于是郑重宣布，今天晚上八点整必须准时睡觉。',
      '天刚擦黑，猫头鹰就拍松了树洞里的干草，规规矩矩地闭上了两只大眼睛。',
      '一分钟过去了，它听见晚风吹过松树梢，沙沙的声音听着实在太舒服了。',
      '五分钟过去了，池塘边的小青蛙开始唱歌，节拍打得还挺整齐，它忍不住跟着点了点头。',
      '猫头鹰赶紧提醒自己要专心睡觉，于是学着别人开始在心里默默数田鼠。',
      '一只田鼠、两只田鼠、三只田鼠，数到第三百只的时候，它反而饿得越来越精神了。',
      '它翻了个身，把翅膀盖在头上，又把翅膀拿下来，怎么躺都觉得今天晚上特别漫长。',
      '就这样折腾着数完星星又听完风声，东边的天空不知不觉泛起了温柔的鱼肚白。',
      '第一缕晨光照进树洞时，猫头鹰终于困得眼皮直打架，连哈欠都接连不断。',
      '它在彻底睡着前迷迷糊糊地想通了，原来早睡的意思，就是早上再睡呀。',
      '想明白这个大道理之后，猫头鹰安心地缩成一团，呼呼大睡起来。'
    ]
  },
  {
    id: 'story_busy_snail',
    name: '《忘记为什么要赶路的蜗牛》',
    category: 'story',
    tags: ['长段故事'],
    desc: '一只神色严肃地横穿整片草坪的蜗牛，适合练从容不急的叙事节奏',
    tip: '跟着蜗牛的节奏慢慢读，句子之间留出舒适的换气空隙。',
    builtin: true,
    lines: [
      '一个清凉的早晨，小蜗牛背好自己的壳，表情非常严肃地出发了。',
      '它打算横穿整片大草坪，去最对面办一件特别重要的事情。',
      '刚爬出半米，路过的小蚂蚁热心地问它，今天这么早要去哪儿呀？',
      '小蜗牛一本正经地回答说，有件天大的要紧事，实在不好意思耽误工夫。',
      '中午太阳暖烘烘的，一只甲虫邀请它一起喝口露水歇一歇。',
      '小蜗牛摇摇触角说，等我把对面那件事办完了，回来再找你慢慢聊。',
      '就这样一路坚持不懈，直到傍晚霞光染红草尖，小蜗牛终于抵达了草坪的另一头。',
      '它停下来长长地舒了一口气，骄傲地回头看了看自己走过的漫长路线。',
      '可就在这一瞬间，它突然愣住了，自己辛辛苦苦爬过来到底是要干嘛来着？',
      '想了足足十分钟，它才恍然大悟，原来只是早上觉得这边的草叶好像比家门口绿一丁点儿。',
      '它凑近仔细瞅了瞅，发现其实跟家门口那片一模一样，于是非常满意地决定明天再爬回去。'
    ]
  },
  {
    id: 'story_squirrel_three',
    name: '《只会数到三的松鼠》',
    category: 'story',
    tags: ['长段故事'],
    desc: '爱囤松果但最多只数到三的小松鼠，短小轻松，适合日常随手练声',
    tip: '自然聊天般的轻柔语流就好，不用刻意用力咬字。',
    builtin: true,
    lines: [
      '老橡树上住着一只记性不太好，但特别喜欢存松果的小松鼠。',
      '这只小松鼠有一个小小的特点，它数数永远只能数到三。',
      '只要松果超过三颗，在它的心里就统统归类为“好多好多”。',
      '秋天风凉了，它忙忙碌碌地把一整个秋天的收成都埋进了树根底下。',
      '为了防止冬天忘记，它还特意找了根小树枝，在树皮上认认真真画了三道杠。',
      '第一场小雪落下来的时候，小松鼠搓着小爪子，兴冲冲地跑去挖自己的宝藏。',
      '它挖出第一颗，数了一声一；挖出第二颗，数了一声二；接着怎么扒拉都摸不到第三颗了。',
      '小松鼠急得绕着老橡树转了好几圈，怀疑是不是被路过的风偷走了一颗。',
      '转得头都有点晕时，它不小心鼓了鼓腮帮子，突然觉得右边脸颊硬邦邦的。',
      '原来刚才挖出来的时候顺嘴塞进去了一颗，这不正好就是第三颗嘛。',
      '小松鼠顿时深深佩服起自己的聪明才智，并决定明年还是只数到三，因为数到四实在太累脑子了。'
    ]
  },
  {
    id: 'story_evening_milk',
    name: '《傍晚的便利店与热牛奶》',
    category: 'story',
    tags: ['长段故事', '气息控制'],
    desc: '傍晚散步、便利店暖光与一瓶热牛奶，安静缓慢的深夜电台感小散文',
    tip: '把语速再放慢两成，像深夜在窗边轻声录音一样，顺着标点柔和换气。',
    builtin: true,
    lines: [
      '傍晚六点半的时候，天色正一点一点沉成温柔的蓝紫色。',
      '街边的路灯次第亮起来，把行道树的影子轻轻拉长在人行道上。',
      '走过拐角那家小小的便利店时，玻璃门里透出一片安静的暖黄色灯光。',
      '推开门，头顶的感应铃叮咚响了一声，像是在轻声和晚归的人打招呼。',
      '店里人不多，冷气和关东煮的香气混在一起，带着一点让人安心的烟火气。',
      '我在热饮柜前站了一会儿，挑了一瓶温热的鲜牛奶，握在手里正好暖暖的。',
      '收银台的小姐姐轻声说了句慢走，我点点头，微笑着回了一句谢谢。',
      '重新走回夜风里时，白天的喧闹和匆忙好像都被留在那扇门后了。',
      '道路渐渐安静下来，偶尔有晚风拂过衣角，带着初秋微凉的草木气息。',
      '捧着温热的瓶身慢慢往家走，每一步都不必着急，也不必赶往什么地方。',
      '原来让人觉得被世界温柔接住的瞬间，往往就是这样一盏灯、一阵风和掌心的一点暖意。'
    ]
  },
  {
    id: 'story_rainy_tea',
    name: '《雨天的窗台与一壶温茶》',
    category: 'story',
    tags: ['长段故事', '气息控制'],
    desc: '周末午后听雨、烧水泡茶的慢节奏静谧散文，多柔元音，适合放松舒缓练声',
    tip: '气息放平、喉咙完全松开，让每个句尾像雨滴一样轻轻落下来。',
    builtin: true,
    lines: [
      '周末的午后，天空轻轻暗了下来，紧接着落起了细细密密的小雨。',
      '雨点敲在阳台的玻璃上，发出不紧不慢的沙沙声，把整间屋子衬得格外安静。',
      '这样的天气里，不用急着出门，也不必立刻回复手机上那些不紧要的消息。',
      '我起身去烧了一壶水，听着壶底的水声从细微的低语慢慢变成温和的翻滚。',
      '往透明的玻璃杯里放进几片白茶，热水注进去的时候，淡雅的清香立刻在空气里散开了。',
      '茶叶在温润的水里缓缓舒展、沉浮，像是在跳一支很慢很慢的舞。',
      '我端着温热的茶杯回到窗边坐下，看玻璃上的雨珠一条条连成透明的小溪。',
      '远处的楼房和树影都融在淡灰色的雨雾里，连平日里匆忙的街道也放慢了脚步。',
      '抿一口温度刚好的茶水，喉咙被轻轻润过，心里那些细碎的思绪也跟着沉静下来。',
      '时间在雨声里变得柔软而绵长，什么都不做，只是安安静静地发一会儿呆就很好。',
      '等雨停的时候，空气一定会格外清透，而我们也会带着这份安宁继续向前走。'
    ]
  },
  // ── 【文学少女】新增 4 篇（博尔赫斯原诗自译节选） ──────────────────────
  {
    id: 'lit_borges_rain',
    name: '博尔赫斯《雨水》（自译节选）',
    category: 'literature',
    tags: ['诗歌朗读', '气息控制'],
    desc: '据豪尔赫·路易斯·博尔赫斯《La lluvia》原诗自译节选，写傍晚骤雨与温柔的时光回响',
    tip: '参考博尔赫斯原诗自译节选，仅供个人发声朗读练习。像念一封给旧时光的轻信一样慢慢读。',
    builtin: true,
    lines: [
      '傍晚的晴空忽然变得澄澈，因为此刻，一场细雨正悄悄落下，或者早已落下。',
      '落雨这件事，无疑总是在过去的时光里发生的。',
      '听见雨声落下的人，便重新拾回了那一刻的记忆。',
      '在遥远的偶然里，一朵名为玫瑰的花，与那抹深红的色彩，曾第一次向他显露。',
      '这场雨轻轻蒙暗了窗玻璃，也将寂静的郊外轻轻打湿。',
      '它落在某座早已不在的庭院里，打湿了一串串深紫色的葡萄。',
      '潮湿的暮色，为我带回了一道我一直渴望听见的声音。',
      '那熟悉的声音正轻声归来，仿佛从未真正远去。'
    ]
  },
  {
    id: 'lit_borges_things',
    name: '博尔赫斯《事物》（自译节选）',
    category: 'literature',
    tags: ['诗歌朗读', '轻柔起音'],
    desc: '据博尔赫斯《Las cosas》原诗自译节选，温柔凝视陪伴我们日常的细小物件',
    tip: '参考博尔赫斯原诗自译节选，仅供个人发声朗读练习。列举物件时保持平缓温和的起伏，不要重读顿挫。',
    builtin: true,
    lines: [
      '手杖、硬币、一串轻响的钥匙圈，还有那把温顺听话的小锁。',
      '那些迟来的笔记，或许在我所剩无几的日子里，已来不及再细细翻读。',
      '纸牌、棋盘、一本书，以及夹在书页之间那朵早已风干的紫罗兰。',
      '它是某个早已淡忘、却一定曾明亮过的傍晚留下的温柔纪念。',
      '还有面朝西方的镜子，在镜面深处，一片虚幻的晨曦正静静燃烧。',
      '数不清的日常小物：旧书页、门槛、地图册、玻璃杯与小小的铁钉。',
      '它们像安静而忠诚的陪伴者，日复一日地留在我们触手可及的地方。',
      '它们如此沉默，又带着某种奇异而柔和的秘密。',
      '它们会比我们的遗忘停留得更久，静静穿过往后的岁月。',
      '而它们永远不会知道，我们曾在这里停留，又已轻轻走远。'
    ]
  },
  {
    id: 'lit_borges_gifts',
    name: '博尔赫斯《另一首关于礼物的诗》（自译节选）',
    category: 'literature',
    tags: ['诗歌朗读', '前腔共鸣'],
    desc: '据博尔赫斯《Otro poema de los dones》原诗自译节选，轻盈明亮的日常感恩诗行',
    tip: '参考博尔赫斯原诗自译节选，仅供个人发声朗读练习。带着淡淡的明亮笑意顺着排比句轻声铺开。',
    builtin: true,
    lines: [
      '我想向世界万物的精妙编织，轻轻道一声感谢。',
      '感谢这世间千姿百态的生命，共同拼出了这座辽阔而奇特的宇宙。',
      '感谢清晨的水声、温热的面包与细盐，托住我们安稳寻常的每一天。',
      '感谢玫瑰的奥秘——它慷慨地绽放着色彩，自己却浑然不觉。',
      '感谢每一个崭新的黎明，让我们醒来时觉得光阴又重新清澈。',
      '感谢音乐，那是时间在空气里化作的最温柔、最神秘的形状。',
      '感谢书页间静静栖息的文字，以及无数个安静而澄明的梦境。',
      '感谢在迷雾里忽然吹来的微风，也感谢微风拂过面颊时的清凉。',
      '感谢人与人之间不期而遇的善意，像暗夜里悄然亮起的一盏小灯。',
      '感谢此刻仍在流淌的呼吸与声音，让平凡的日常拥有了光亮。'
    ]
  },
  {
    id: 'lit_borges_english',
    name: '博尔赫斯《我用什么留住你》（自译节选）',
    category: 'literature',
    tags: ['诗歌朗读', '声调托底'],
    desc: '据博尔赫斯《Two English Poems II》原诗自译节选，克制而深沉的轻声独白',
    tip: '参考博尔赫斯原诗自译节选，仅供个人发声朗读练习。句尾多为深情陈述，注意柔和托住尾音不沉垮。',
    builtin: true,
    lines: [
      '我能用什么来留住你呢？',
      '我送你清瘦的街道、炽烈而微凉的日落，以及远郊边际那一弯清冷的月亮。',
      '我送你一个曾长久凝望孤月的人，心底沉淀下来的温柔与怅惘。',
      '我送你我的书本里，或许尚存的一星半点微光与洞见。',
      '我送你一段记忆：那是在你出生之前的某个黄昏里，人们曾看见的一朵黄玫瑰。',
      '我送你关于你自己的注解、猜想，以及那些真实而令人惊喜的消息。',
      '我能赠予你的，还有我的静默、我走过的微暗时刻，以及心底长久的渴望。',
      '我正试着用不确定、用温柔的停留，与这片静谧的夜色，轻轻挽留你。'
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
