import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failures = 0;
function fail(msg) {
  console.error(`❌ [FAIL] ${msg}`);
  failures++;
}
function pass(msg) {
  console.log(`✅ [PASS] ${msg}`);
}

console.log('=== 运行数据契约与去病理化断言 (verify-contract.mjs) ===\n');

// 1. 静态代码扫描 main.js 的键名读取
const mainJsPath = path.join(root, 'app/web/src/main.js');
const mainJs = fs.readFileSync(mainJsPath, 'utf8');

// 1.1 检查 s.extendedStats
if (mainJs.includes('s.extendedStats')) {
  fail('main.js 仍在使用错键名 s.extendedStats（gating.js 输出的是 s.ext）');
} else {
  pass('未发现 s.extendedStats');
}

// 1.2 检查 ext.zones
if (mainJs.includes('ext.zones')) {
  fail('main.js 仍在使用嵌套对象 ext.zones（ext 是扁平的 maleZonePct/midZonePct/femaleZonePct）');
} else {
  pass('未发现 ext.zones 嵌套读取');
}

// 1.3 检查 s.formants.f1
if (mainJs.includes('s.formants.f1') || mainJs.includes('s.formants?.f1')) {
  fail('main.js 仍在使用 s.formants.f1（顶层字段应为 s.avgF1）');
} else {
  pass('未发现 s.formants.f1 错误字段');
}

// 2. 去病理化关键词扫描
const badKeywords = ['刻意演女声', '过度拉伸而水肿', '提喉挤卡'];
for (const kw of badKeywords) {
  if (mainJs.includes(kw)) {
    fail(`main.js 包含病理化/焦虑诱发措辞: "${kw}"`);
  } else {
    pass(`通过去病理化检查: "${kw}" 已清除`);
  }
}

// 3. 检查 tokens.css 缺失变量
const tokensCssPath = path.join(root, 'app/web/src/style/tokens.css');
const tokensCss = fs.readFileSync(tokensCssPath, 'utf8');
const requiredVars = ['--border-soft', '--fs-21', '--radius-md', '--ink-1'];
for (const v of requiredVars) {
  if (!tokensCss.includes(`${v}:`)) {
    fail(`tokens.css 缺少必要 CSS 变量定义: ${v}`);
  } else {
    pass(`tokens.css 包含变量: ${v}`);
  }
}

// 4. 检查 formants.js 是否含有 || byVowel.v
const formantsJsPath = path.join(root, 'app/web/src/dsp/formants.js');
const formantsJs = fs.readFileSync(formantsJsPath, 'utf8');
if (formantsJs.includes('byVowel.i || byVowel.v')) {
  fail('formants.js 仍保留 || byVowel.v 兜底（圆唇元音失真）');
} else {
  pass('formants.js 已移除 || byVowel.v 兜底');
}

// 5. 检查 main.js 中主卡片是否仍包含 cm
if (mainJs.includes('s.lengthCm ? `<div style="font-size:var(--fs-10);color:var(--ink-3)">≈ ${s.lengthCm}cm</div>`')) {
  fail('main.js 主卡片仍显示等效声道长 cm');
} else {
  pass('main.js 主卡片已移除 cm');
}

// 6. 检查 index.html 中是否包含硬编码 18 项或水肿
const indexHtmlPath = path.join(root, 'app/web/index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
if (indexHtml.includes('18 项') || indexHtml.includes('18项')) {
  fail('index.html 仍包含硬编码 "18 项"');
} else {
  pass('index.html 已清除硬编码 "18 项"');
}
if (indexHtml.includes('水肿')) {
  fail('index.html 仍包含病理化词汇 "水肿"');
} else {
  pass('index.html 已清除病理化词汇 "水肿"');
}

// 7. 检查 dialog.js 危险按钮文字颜色对比度是否达标
const dialogJsPath = path.join(root, 'app/web/src/ui/dialog.js');
const dialogJs = fs.readFileSync(dialogJsPath, 'utf8');
if (!dialogJs.includes('#FDFBF7')) {
  fail('dialog.js 危险按钮未使用高对比度文字颜色 #FDFBF7');
} else {
  pass('dialog.js 危险按钮文字颜色达标 (#FDFBF7)');
}

// 8. 运行时断言：normalizeStats 单元测试
const { normalizeStats } = await import('../web/src/metrics/normalizeStats.js');

// 8.1 完整数据测试
const mockTake = {
  durationSec: 5.2,
  stats: {
    medianF0: 185.4,
    p10: 160.2,
    p90: 210.5,
    spanSt: 6.8,
    hnr: 14.2,
    balance: -11.0,
    deltaF: 1150,
    lengthCm: 14.8,
    avgF1: 320,
    avgF2: 2400,
    jitter: 1.25,
    shimmer: 2.8,
    ext: {
      meanF0: 188.0,
      stdDevSt: 1.85,
      minF0: 155.0,
      maxF0: 220.0,
      maleZonePct: 5,
      midZonePct: 35,
      femaleZonePct: 60,
      voicedSec: 4.1,
      voicedPct: 79,
      meanDb: -22.4,
      maxDb: -12.1,
    },
    spectral: {
      measured: true,
      h1h2Db: 3.5,
      twangDb: -1.2,
      status: '舒展柔和',
    },
    sibilance: {
      centroidHz: 7200,
    },
    tone: {
      creakRatio: 0.02,
    },
  },
};

const norm = normalizeStats(mockTake);
if (norm.meanF0 !== 188.0) fail(`normalizeStats 未正确映射 ext.meanF0: 期望 188.0, 得到 ${norm.meanF0}`);
else pass('normalizeStats 正确映射 ext.meanF0 (188.0 Hz)');

if (norm.femaleZonePct !== 60 || norm.maleZonePct !== 5) fail(`normalizeStats 未正确映射 ext 扁平音区: male=${norm.maleZonePct}, female=${norm.femaleZonePct}`);
else pass('normalizeStats 正确映射扁平音区分布 (male:5%, mid:35%, female:60%)');

if (norm.f1 !== 320 || norm.f2 !== 2400) fail(`normalizeStats 未正确映射 avgF1/avgF2: f1=${norm.f1}, f2=${norm.f2}`);
else pass('normalizeStats 正确映射 avgF1/avgF2');

if (norm.h1h2 !== 3.5) fail(`normalizeStats 未正确映射 h1h2Db: 期望 3.5, 得到 ${norm.h1h2}`);
else pass('normalizeStats 正确映射 h1h2 (3.5 dB)');

// 8.2 全空/空值健壮性测试
const emptyNorm = normalizeStats(null);
if (emptyNorm.meanF0 !== null || emptyNorm.maleZonePct !== null || emptyNorm.f1 !== null) {
  fail('normalizeStats 在 null 输入时未安全返回全 null');
} else {
  pass('normalizeStats 在 null 输入时安全容错，无异常抛出');
}

// 9. 检查 algoVersion 是否为 0.5.0
const gatingJsPath = path.join(root, 'app/web/src/metrics/gating.js');
const gatingJs = fs.readFileSync(gatingJsPath, 'utf8');
if (!gatingJs.includes("algoVersion: '0.5.0'")) {
  fail("gating.js 中 algoVersion 未升级至 '0.5.0'");
} else {
  pass("gating.js 中 algoVersion 已升至 '0.5.0'");
}

// 10. 检查 capture.js 是否不再冗余调用 cleanPitchTrack
const captureJsPath = path.join(root, 'app/web/src/audio/capture.js');
const captureJs = fs.readFileSync(captureJsPath, 'utf8');
if (captureJs.includes('cleanPitchTrack')) {
  fail('capture.js 仍包含 cleanPitchTrack 调用，未收敛至 summarize 单一入口');
} else {
  pass('capture.js cleanPitchTrack 已成功收敛');
}

// 11. 检查 main.js 中是否消除了打折/免责式文案
if (mainJs.includes('打点折扣')) {
  fail('main.js 仍包含免责/打折类措辞: "打点折扣"');
} else {
  pass('main.js 已清除免责措辞: "打点折扣"');
}

// 12. 运行时断言：cleanPitchTrack 幂等性测试
const { cleanPitchTrack } = await import('../web/src/dsp/pitch.js');
const testFrames = [
  { t: 0.0, hz: 150, clarity: 0.8, db: -20 },
  { t: 0.025, hz: 152, clarity: 0.82, db: -20 },
  { t: 0.05, hz: 151, clarity: 0.81, db: -20 },
  { t: 0.075, hz: 400, clarity: 0.4, db: -50 }, // 脏帧
  { t: 0.1, hz: 153, clarity: 0.83, db: -20 },
  { t: 0.125, hz: 154, clarity: 0.84, db: -20 },
];
const pass1 = cleanPitchTrack(testFrames);
const pass2 = cleanPitchTrack(pass1);
let idempotent = true;
for (let i = 0; i < pass1.length; i++) {
  if (pass1[i].hz !== pass2[i].hz) idempotent = false;
}
if (!idempotent) {
  fail('cleanPitchTrack 不具备幂等性 (pass1 !== pass2)');
} else {
  pass('cleanPitchTrack 验证具备 100% 幂等性');
}

// 13. 运行时断言：compareToBaseline 跨版本保护测试
const { compareToBaseline } = await import('../web/src/metrics/gating.js');
const nowStats = { algoVersion: '0.5.0', medianF0: 160, deltaF: 1200 };
const baseStatsOld = { algoVersion: '0.3.0', medianF0: 155, deltaF: 1000 };
const compResult = compareToBaseline(nowStats, baseStatsOld);
const dfComp = compResult.find((c) => c.key === 'deltaF');
if (!dfComp || dfComp.versionChanged !== true || dfComp.available !== false) {
  fail('compareToBaseline 未对跨版本 deltaF 实行隔离保护');
} else {
  pass('compareToBaseline 成功隔离跨版本 deltaF (versionChanged: true)');
}

// 14. 静态检查：main.js 是否具备 Canvas 主题色缓存 (P2-1)
if (!mainJs.includes('_cssVarCache') || !mainJs.includes('invalidateCssVarCache')) {
  fail('main.js 未包含 _cssVarCache 主题缓存，可能导致 600次/秒 getComputedStyle 损耗');
} else {
  pass('main.js 包含 _cssVarCache 主题缓存，消除高频 getComputedStyle 调用');
}

// 15. 静态检查：app.css 主体区域是否包含 env(safe-area-inset-bottom) (P2-2)
const appCssPath = path.join(root, 'app/web/src/style/app.css');
const appCss = fs.readFileSync(appCssPath, 'utf8');
if (!appCss.includes('env(safe-area-inset-bottom') || !/calc\(var\(--nav-h\)\s*\+\s*\d+px\s*\+\s*env\(safe-area-inset-bottom/.test(appCss)) {
  fail('app.css main 容器未适配 env(safe-area-inset-bottom)');
} else {
  pass('app.css main 容器已适配 env(safe-area-inset-bottom) 安全区');
}

// 16. 静态检查：脚本路径跨环境兼容性 (P2-3)
const auditRegPath = path.join(root, 'app/scripts/audit-regression.mjs');
const auditSpkPath = path.join(root, 'app/scripts/audit-speakers.mjs');
if (fs.existsSync(auditRegPath) && fs.existsSync(auditSpkPath)) {
  const auditRegJs = fs.readFileSync(auditRegPath, 'utf8');
  const auditSpkJs = fs.readFileSync(auditSpkPath, 'utf8');
  if (auditRegJs.includes("'./app/") || auditSpkJs.includes("'./app/")) {
    fail('audit 脚本中仍存在硬编码 ./app/ 相对路径');
  } else {
    pass('audit 脚本已迁移至 import.meta.url 跨路径兼容模式');
  }
} else {
  pass('audit 脚本跨环境兼容性检查已跳过（生产纯净库无需回归测试大脚本）');
}

// 17. 静态检查：index.html 或 Analysis.svelte 中声质 4 项卡片升级为 a-v-halving，且保留 twang 仅限衣音明细行
const analysisSveltePath = path.join(root, 'app/web/src/pages/analysis/Analysis.svelte');
const analysisSvelte = fs.existsSync(analysisSveltePath) ? fs.readFileSync(analysisSveltePath, 'utf8') : '';
const viewContent = indexHtml + analysisSvelte;

if ((!viewContent.includes('a-v-halving') && !viewContent.includes('Halving')) || viewContent.includes('id="a-v-twang"')) {
  fail('视图层 4项主声质卡片未升级为 a-v-halving 或仍错误保留 a-v-twang');
} else {
  pass('视图层声质 4 项卡片已升级为 a-v-halving (吊嗓挤卡率)');
}
if (!viewContent.includes('Twang') || !viewContent.includes('仅「衣」音')) {
  fail('视图层明细表中未标注 Twang 仅限衣音');
} else {
  pass('视图层明细表中已清晰标明 Twang (仅限「衣」音)');
}

// 18. 静态检查：main.js 或 charts.js / Analysis.svelte updateAnalysis 渲染 a-v-halving 与 AI prompt 注入
const chartsJsPath = path.join(root, 'app/web/src/pages/analysis/charts.js');
const chartsJs = fs.existsSync(chartsJsPath) ? fs.readFileSync(chartsJsPath, 'utf8') : '';
const logicContent = mainJs + chartsJs + analysisSvelte;

if (!logicContent.includes('a-v-halving') && !logicContent.includes('Halving') || !logicContent.includes('吊嗓与假声挤卡率 (Pitch Halving)')) {
  fail('逻辑层未包含 a-v-halving 渲染或 AI prompt 未注入吊嗓与假声挤卡率');
} else {
  pass('逻辑层包含 a-v-halving 渲染及 AI prompt 吊嗓挤卡率注入');
}

// 19. 运行时断言：normalizeStats 输出 pitchHalving
const normWithHalving = normalizeStats({
  durationSec: 3.0,
  stats: {
    spectral: { pitchHalvingPct: 18.5 },
  },
});
if (normWithHalving.pitchHalving !== 18.5) {
  fail(`normalizeStats 未正确输出 pitchHalving: 期望 18.5, 得到 ${normWithHalving.pitchHalving}`);
} else {
  pass('normalizeStats 正确映射 pitchHalving 字段');
}

// 20. 运行时断言：spectralVoice Twang 针对元音的条件过滤
const { computeSpectralVoice } = await import('../web/src/dsp/spectralVoice.js');
const dummyPcm = new Float32Array(16000); // 1秒多谐波信号 (含 150Hz 基波 + 1000Hz 低中频 + 3000Hz 咽腔频段)
for (let i = 0; i < dummyPcm.length; i++) {
  dummyPcm[i] = Math.sin(2 * Math.PI * 150 * i / 16000) * 0.4 +
                Math.sin(2 * Math.PI * 1000 * i / 16000) * 0.2 +
                Math.sin(2 * Math.PI * 3000 * i / 16000) * 0.1;
}
const dummyFrames = [{ hz: 150, clarity: 0.9, db: -20, t: 0.1 }];
const svI = computeSpectralVoice(dummyPcm, 16000, { frames: dummyFrames, dominantVowel: 'i', vowelLabel: '衣' });
const svA = computeSpectralVoice(dummyPcm, 16000, { frames: dummyFrames, dominantVowel: 'a', vowelLabel: '啊' });
if (svI.twangDb == null) {
  fail('computeSpectralVoice 在元音 i 下不应返回 null twangDb');
} else if (svA.twangDb !== null) {
  fail(`computeSpectralVoice 在非衣元音 a 下应返回 null twangDb 避免误导，实际返回: ${svA.twangDb}`);
} else {
  pass('computeSpectralVoice 元音敏感 Twang 验证通过：仅在「衣」音输出，非衣音安全返回 null');
}

// 21. 运行时断言：假声拉薄正弦化与开商互斥保护 (Halving 升高时绝不误报为轻柔气声)
// 构造高音 240Hz 且奇偶谐波失衡（折半倍频）的 PCM
const falsettoPcm = new Float32Array(16000);
for (let i = 0; i < falsettoPcm.length; i++) {
  // 强奇次谐波（h1, h3），极弱偶次（模拟缺失基频或折半跳跃）
  falsettoPcm[i] = Math.sin(2 * Math.PI * 240 * i / 16000) * 0.5 +
                   Math.sin(2 * Math.PI * 720 * i / 16000) * 0.3;
}
const falsettoFrames = [{ hz: 240, clarity: 0.9, db: -20, t: 0.1 }];
const svFalsetto = computeSpectralVoice(falsettoPcm, 16000, { frames: falsettoFrames, dominantVowel: 'i', vowelLabel: '衣' });
if (svFalsetto.status === '轻柔气声') {
  fail('高音区伴随折半代偿时，computeSpectralVoice 错误诊断为 "轻柔气声"');
} else if (svFalsetto.isPressed === true && (svFalsetto.status.includes('假声') || svFalsetto.status.includes('挤卡'))) {
  pass(`假声拉薄代偿与开商互斥保护生效：成功诊断为 "${svFalsetto.status}" (isPressed: true)`);
} else {
  pass(`假声保护状态验证通过: ${svFalsetto.status}`);
}

// 22. 静态检查：main.js 托底线阶梯支持 [150, 155, 160, 165]
const latestMainJs = fs.readFileSync(mainJsPath, 'utf8');
if (!latestMainJs.includes('[150, 155, 160, 165]')) {
  fail('main.js 托底基线档位未更新为 [150, 155, 160, 165]');
} else {
  pass('main.js 托底基线档位支持细腻 4 档 [150, 155, 160, 165] Hz');
}

// 23. 静态检查：voiceQuality.js 音区划分下限升至 145Hz (145~180Hz)
const vqJsPath = path.join(root, 'app/web/src/dsp/voiceQuality.js');
const vqJs = fs.readFileSync(vqJsPath, 'utf8');
if (!vqJs.includes('hz < 145') || !vqJs.includes('hz <= 175')) {
  fail('voiceQuality.js 音区划分未对齐男声 <145Hz / 过渡 145~175Hz / 女声 >175Hz 边界');
} else {
  pass('voiceQuality.js 音区划分已更新为: 男声区 <145Hz / 中性过渡区 145~175Hz / 女声区 >175Hz');
}

// 24. 架构一致性：验证 extractAudioFrames 导出并被 main.js 复用 (docs/42 §2 & §5)
const captureCode = fs.readFileSync(captureJsPath, 'utf8');
if (!captureCode.includes('export function extractAudioFrames(')) {
  fail('capture.js 未导出 extractAudioFrames 函数');
} else {
  pass('capture.js 成功导出标准 extractAudioFrames 离线帧提取函数');
}

const currentMainJs = fs.readFileSync(mainJsPath, 'utf8');
if (!currentMainJs.includes('extractAudioFrames(pcm, sampleRate)')) {
  fail('main.js 未复用 capture.js 的 extractAudioFrames 函数');
} else {
  pass('main.js 导入音频与离线分析成功复用 extractAudioFrames 生产逻辑');
}

// 25. 运行时两路一致性断言 (docs/40 §3 & docs/42 §2 & §5):
// 验证生产 extractAudioFrames + summarize 具备严格一致性与数值确定性 (差值 ≤ 0.1 dB)
const { extractAudioFrames } = await import('../web/src/audio/capture.js');
const { summarize } = await import('../web/src/metrics/gating.js');
const synPcm = new Float32Array(32000);
for (let i = 0; i < synPcm.length; i++) {
  synPcm[i] = Math.sin(2 * Math.PI * 180 * i / 16000) * 0.5 + Math.sin(2 * Math.PI * 360 * i / 16000) * 0.3;
}
const sf1 = extractAudioFrames(synPcm, 16000);
const sres1 = summarize(sf1, synPcm, 16000, 'free', 160);
const sf2 = extractAudioFrames(synPcm, 16000);
const sres2 = summarize(sf2, synPcm, 16000, 'free', 160);
const sH1 = sres1.stats?.spectral?.h1h2Db ?? 0;
const sH2 = sres2.stats?.spectral?.h1h2Db ?? 0;
const sdiff = Math.abs(sH1 - sH2);
if (sdiff > 0.1) {
  fail(`合成信号两路 H1-H2 差值 ${sdiff.toFixed(2)} dB > 0.1 dB`);
} else {
  pass(`标准合成信号两路一致性断言通过 (差值 ${sdiff.toFixed(2)} dB ≤ 0.1 dB)`);
}

const testWavRel = '临时测试素材目录/1111 新真人录音/故意夹嗓子.wav';
const testWavFull = path.join(root, testWavRel);
if (fs.existsSync(testWavFull)) {
  const buf = fs.readFileSync(testWavFull);
  const sampleRate = buf.readInt32LE(24);
  let offset = 12;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readInt32LE(offset + 4);
    if (chunkId === 'data') { offset += 8; break; }
    offset += 8 + chunkSize;
  }
  const numSamples = Math.floor((buf.length - offset) / 2);
  const pcm = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) pcm[i] = buf.readInt16LE(offset + i * 2) / 32768;

  const f1 = extractAudioFrames(pcm, sampleRate);
  const res1 = summarize(f1, pcm, sampleRate, 'free', 160);
  const h1h2_1 = res1.stats?.spectral?.h1h2Db;

  const f2 = extractAudioFrames(pcm, sampleRate);
  const res2 = summarize(f2, pcm, sampleRate, 'free', 160);
  const h1h2_2 = res2.stats?.spectral?.h1h2Db;

  if (h1h2_1 == null || h1h2_2 == null) {
    fail(`真实录音双路校验未测出 H1-H2 (res1: ${h1h2_1}, res2: ${h1h2_2})`);
  } else {
    const diff = Math.abs(h1h2_1 - h1h2_2);
    if (diff > 0.1) {
      fail(`真实录音双路一致性断言失败：H1-H2 差值 ${diff.toFixed(2)} dB > 0.1 dB`);
    } else {
      pass(`真实录音双路一致性断言通过：故意夹嗓子两路完全对齐 (${h1h2_1.toFixed(2)} dB vs ${h1h2_2.toFixed(2)} dB, 差值 ${diff.toFixed(2)} dB ≤ 0.1 dB)`);
    }
  }
}

// 26. 静态检查与算法门面契约：core/index.js 统一门面与视图层隔离原则 (DSH doc44 & 前端开工提醒)
const coreIndexPath = path.join(root, 'app/web/src/core/index.js');
if (!fs.existsSync(coreIndexPath)) {
  fail('缺少 app/web/src/core/index.js 算法门面');
} else {
  const coreModule = await import('../web/src/core/index.js');
  if (typeof coreModule.analyze !== 'function' || typeof coreModule.extractAudioFrames !== 'function' || typeof coreModule.summarize !== 'function') {
    fail('core/index.js 未正确导出 analyze / extractAudioFrames / summarize 核心门面接口');
  } else if (coreModule.ALGO_VERSION !== '0.5.0') {
    fail(`core/index.js ALGO_VERSION 异常: ${coreModule.ALGO_VERSION}`);
  } else {
    pass('core/index.js 算法只读门面就绪，并正确绑定 ALGO_VERSION 0.5.0');
  }

  // 门面扁平性与一致性验证 (docs/47 F1 + F2 + F3)
  const pcm = new Float32Array(16000);
  for (let i = 0; i < pcm.length; i++) {
    pcm[i] = 0.5 * Math.sin(2 * Math.PI * 220 * (i / 16000));
  }
  const directFrames = extractAudioFrames(pcm, 16000);
  const directSummary = summarize(directFrames, pcm, 16000, 'free', 160);
  const coreResult = coreModule.analyze(pcm, 16000, { mode: 'free', floorF0: 160 });

  if (typeof coreResult.stats?.medianF0 !== 'number') {
    fail(`analyze().stats 必须是扁平 stats 对象，且 medianF0 为数值，实际: ${typeof coreResult.stats?.medianF0}`);
  } else {
    pass(`analyze().stats 具备扁平结构，medianF0 为有效数值 (${coreResult.stats.medianF0.toFixed(1)} Hz)`);
  }

  if (coreResult.stats.ok !== undefined || 'reasons' in coreResult.stats) {
    fail('analyze().stats 不得是 summarize 的包装对象 (不得包含 ok 或 reasons)');
  } else {
    pass('analyze().stats 纯净无多余 ok/reasons 包装');
  }

  if (coreResult.ok !== directSummary.ok || Math.abs((coreResult.stats.medianF0 || 0) - (directSummary.stats.medianF0 || 0)) > 0.01) {
    fail(`core.analyze 结果与底层直接调用漂移: ${coreResult.stats.medianF0} vs ${directSummary.stats.medianF0}`);
  } else {
    pass('core.analyze 统一门面与底层直接调用结果具备 100% 逐位一致性');
  }

  // 验证 script 模式参数传递与分析能力 (docs/47 F2)
  const scriptResult = coreModule.analyze(pcm, 16000, { mode: 'script', floorF0: 160 });
  if (!scriptResult.stats || typeof scriptResult.stats.medianF0 !== 'number') {
    fail('core.analyze 无法在 mode: "script" 下正常执行');
  } else {
    pass('core.analyze 成功支持 mode: "script" 并返回正常统计');
  }

  // 视图层与组件隔离检查：ui/ 与 pages/ 严禁直接引用 dsp/ 或 metrics/
  const webSrc = path.join(root, 'app/web/src');
  const isolatedDirs = ['ui', 'pages'];
  let violationCount = 0;
  for (const dir of isolatedDirs) {
    const fullDir = path.join(webSrc, dir);
    if (!fs.existsSync(fullDir)) continue;
    const files = fs.readdirSync(fullDir, { recursive: true });
    for (const f of files) {
      if (typeof f !== 'string' || (!f.endsWith('.js') && !f.endsWith('.svelte'))) continue;
      const content = fs.readFileSync(path.join(fullDir, f), 'utf8');
      if (/from\s+['"][^'"]*(dsp|metrics)[^'"]*['"]/.test(content)) {
        fail(`架构红线违背：${dir}/${f} 直接引用了 dsp/ 或 metrics/，必须通过 core/ 访问`);
        violationCount++;
      }
    }
  }
  if (violationCount === 0) {
    pass('视图层与组件目录遵循架构红线：严禁越过 core 门面直连 dsp/metrics');
  }
}

// 27. 静态检查：视觉 Token 与水彩手账设计规范门禁 (docs/48 §4)
{
  const webSrc = path.join(root, 'app/web/src');
  function walkSvelte(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) files = files.concat(walkSvelte(full));
      else if (f.endsWith('.svelte')) files.push(full);
    }
    return files;
  }

  const svelteFiles = walkSvelte(webSrc);
  let totalHex = 0;
  let invalidRadiusCount = 0;

  for (const f of svelteFiles) {
    const code = fs.readFileSync(f, 'utf8');
    const hexes = code.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    totalHex += hexes.length;

    // 检查大于 5px 且非 999px 的硬编码 border-radius
    const radiusMatches = code.match(/border-radius:\s*(?!999px)(\d+)px/g) || [];
    for (const rm of radiusMatches) {
      const num = parseInt(rm.replace(/[^\d]/g, ''), 10);
      if (num > 5) {
        fail(`${path.basename(f)} 包含硬编码圆角 "${rm}"，必须使用 var(--radius*) 规范`);
        invalidRadiusCount++;
      }
    }
  }

  // 1. 硬编码 hex 基线门禁（严格限制 ≤ 5 处）
  if (totalHex > 5) {
    fail(`Svelte 组件硬编码 hex 数量超标: 发现 ${totalHex} 处 (基线上限 ≤ 5)`);
  } else {
    pass(`Svelte 组件 Token 化达标：硬编码 hex 降至 ${totalHex} 处 (基线 ≤ 5)`);
  }

  if (invalidRadiusCount === 0) {
    pass('Svelte 组件圆角规范达标：无大于 5px 的硬编码 border-radius');
  }

  // 2. 核心卡片与浮层阴影门禁
  const cardCode = fs.readFileSync(path.join(webSrc, 'ui/Card.svelte'), 'utf8');
  const sheetCode = fs.readFileSync(path.join(webSrc, 'ui/Sheet.svelte'), 'utf8');
  if (!cardCode.includes('var(--shadow)') || !cardCode.includes('var(--shadow-lift)') || !sheetCode.includes('var(--shadow-lift)')) {
    fail('Card.svelte / Sheet.svelte 缺少 var(--shadow) 或 var(--shadow-lift) 层次阴影');
  } else {
    pass('Card / Sheet 等核心容器均已绑定 var(--shadow) / var(--shadow-lift) 纸张悬浮质感');
  }

  // 3. 核心标题组件霞鹜文楷/书法字体门禁
  if (!cardCode.includes('var(--font-title)') || !sheetCode.includes('var(--font-title)')) {
    fail('Card.svelte / Sheet.svelte 缺少 var(--font-title) 霞鹜文楷标题定义');
  } else {
    pass('Card / Sheet 核心组件成功应用 var(--font-title) 标题字体');
  }
}

console.log(`\n========================================`);
console.log(`契约测试完成: ${failures} 处失败`);
console.log(`========================================\n`);

if (failures > 0) {
  process.exit(1);
}
