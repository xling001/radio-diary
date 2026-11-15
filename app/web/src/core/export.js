/* ===========================================================
   core/export.js — 导出引擎 (Export Engine)

   【功能矩阵】
   1. toExport(take): 白名单抽取纯净声学契约对象（剔除内部调试字段）；
   2. renderDiaryMarkdown(take): 生成面向个人的温情「声音日记」Markdown；
   3. renderConsultationMarkdown(take): 生成面向 AI 的结构化「咨询包」Markdown（含口径注）；
   4. renderBatchMarkdown(takes): 生成多段录音横向对比 Markdown（含素材可比性自动判定）；
   5. saveMarkdownFile(content, fileName): 原生桥接 / Web Share / 下载降级保存。
   =========================================================== */

import { normalizeStats } from '../metrics/normalizeStats.js';
import { pitchName, ALGO_VERSION } from './index.js';
import { KB_VERSION } from '../metrics/kbNorms.js';

/**
 * 格式化本地时间 YYYY-MM-DD HH:mm
 */
function formatLocalTime(ts) {
  const d = new Date(ts || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

/**
 * 格式化文件名时间戳 YYYYMMDD_HHmm
 */
function formatFileStamp(ts) {
  const d = new Date(ts || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}${m}${day}_${h}${min}`;
}

/**
 * 白名单数据抽取 (docs/60 §2)
 * 严格剔除 clarityHnr、内部 cpp 等未对齐的中间字段。
 * @param {object} take 录音记录对象
 * @returns {object} 纯净导出契约对象
 */
export function toExport(take) {
  if (!take) return null;
  const norm = normalizeStats(take);
  const setName = take.setName
    ? take.setName.trim()
    : (take.mode === 'free' ? '自由表达' : (take.mode === 'import' ? '本地导入' : '发声练习'));

  return {
    id: take.id,
    ts: take.ts,
    tsLocal: formatLocalTime(take.ts),
    mode: take.mode || 'free',
    setName,
    durationSec: norm.totalSec,
    voicedSec: norm.voicedSec,
    voicedPct: norm.voicedPct,
    ok: take.ok ?? true,
    reasons: take.reasons || [],
    stamp: take.stamp || null,
    f0: {
      median: norm.medianF0,
      mean: norm.meanF0,
      p10: norm.p10,
      p90: norm.p90,
      spanSt: norm.spanSt,
      stdF0St: norm.stdF0St,
      maleZonePct: norm.maleZonePct,
      midZonePct: norm.midZonePct,
      femaleZonePct: norm.femaleZonePct,
    },
    weight: {
      h1h2: norm.h1h2,
      halving: norm.pitchHalving,
      jitter: norm.jitter,
      shimmer: norm.shimmer,
      hnr: norm.hnr,
    },
    resonance: {
      deltaF: norm.deltaF,
      f1: norm.f1,
      f2: norm.f2,
    },
    fricative: {
      centroidHz: norm.sibilance,
    },
    tone: {
      floorSafeRatio: norm.floorSafeRatio,
      floorTargetHz: norm.floorTargetHz,
      creakRatio: norm.creakRatio,
    },
    algoVersion: take.algoVersion || ALGO_VERSION,
    kbVersion: KB_VERSION,
  };
}

function formatStampSummary(stamp) {
  if (!stamp) return '';
  const parts = [];
  if (stamp.mood) {
    parts.push(String(stamp.mood).trim());
  } else if (stamp.emoji || stamp.text) {
    parts.push([stamp.emoji, stamp.text].filter(Boolean).join(' ').trim());
  }
  const throat = Array.isArray(stamp.throats) && stamp.throats.length
    ? stamp.throats.join(' · ')
    : stamp.throat;
  if (throat) parts.push(`体感：${throat}`);
  if (stamp.note) parts.push(`备注：${stamp.note}`);
  return parts.filter(Boolean).join(' | ');
}

/**
 * 生成形态一 ·「声音日记」（适合人读、自存档）
 * @param {object} take
 * @returns {string} Markdown
 */
export function renderDiaryMarkdown(take) {
  const exp = toExport(take);
  if (!exp) return '';

  const stampText = formatStampSummary(exp.stamp);
  const stampLine = stampText ? ` · 体感印章：${stampText}` : '';
  const durLine = exp.durationSec != null
    ? `${exp.durationSec.toFixed(1)} 秒（有效发音：${exp.voicedSec != null ? exp.voicedSec.toFixed(1) + ' 秒' : '—'}）`
    : '—';

  return `# 电波日记 · 声音日记

> 记录时间：${exp.tsLocal} · 素材：${exp.setName}${stampLine}  
> 录音时长：${durLine}

## 核心发声数据
| 指标 | 本次测量 | 参考区间 | 说明 |
| :--- | :--- | :--- | :--- |
| **中位基频 (F0)** | ${exp.f0.median ? Math.round(exp.f0.median) + ' Hz (' + pitchName(exp.f0.median) + ')' : '—'} | 145~175 Hz (过渡) · >175 Hz (女声常见) | 说话时基础音高的中位数 |
| **音高起伏 (Span)** | ${exp.f0.spanSt != null ? exp.f0.spanSt.toFixed(1) + ' 半音' : '—'} | 3.0 ~ 6.0 半音 (日常交流常见) | 语调高低跨度（P10–P90，不含尾音淡出） |
| **安全托底率** | ${exp.tone.floorSafeRatio != null ? exp.tone.floorSafeRatio + '%' : '—'} | ≥ 85% (托底线 ${exp.tone.floorTargetHz || 160} Hz) | 统计说话时不跌破设定低音线的比例 |
| **发声轻重 (H1−H2)** | ${exp.weight.h1h2 != null ? exp.weight.h1h2.toFixed(1) + ' dB' : '未检出'} | -1.2 ~ 3.5 dB (适中偏轻参考) | 反映声带贴合轻重：负值偏紧，正值偏柔气声 |
| **前腔共鸣 (ΔF)** | ${exp.resonance.deltaF ? Math.round(exp.resonance.deltaF) + ' Hz' : '未测出'} | 1000 ~ 1250 Hz (仅供参考) | 声道共鸣尺度参考（前高元音测定） |
${exp.fricative.centroidHz != null ? `| **咝音清脆度 (/s/)** | ${(exp.fricative.centroidHz / 1000).toFixed(1)} kHz | 6.0 ~ 8.5 kHz (清晰常见) | /s/ 音高频重心位置 |\n` : ''}
${exp.reasons?.length ? `\n> 录音提醒：${exp.reasons.join(' · ')}\n` : ''}
> 提示：本数据由「电波日记」离线测算。受口型、录音环境与素材影响较大，适合与自己过往记录对比，不必拘泥于单次数字。
`;
}

/**
 * 生成形态二 ·「AI 咨询包」（结构化 Markdown，给大模型或医生读）
 * @param {object} take
 * @returns {string} Markdown
 */
export function renderConsultationMarkdown(take) {
  const exp = toExport(take);
  if (!exp) return '';

  return `<!-- qinglai-export v1 · format:consultation · algoVersion:${exp.algoVersion} · kbVersion:${exp.kbVersion} -->
# 电波日记 · 结构化发声数据与咨询包

> 口径速记：F0 为有声帧中位数；起伏为 P10–P90 半音跨度（已剔除句尾淡出）；  
> ΔF 仅取前高元音 /i/ 帧，值为 1000–1250 Hz 量级；H1−H2 负值偏紧（<-1.2dB）、0 附近为流动轻音重；  
> Jitter/Shimmer 语流（上限 2.8%/8.0%）不可与稳态长音直接套用；移动端离散分帧测算的稳态长音 Jitter（常模 1.1%~1.7%）约为主流连续金标准（如 Praat PointProcess）的 2~3 倍，切勿跨工具直接硬套临床病理门限；“未测出”表示该特征本次不成立，不等于发声异常。

## 记录概况
- 记录时间：${exp.tsLocal}
- 练习模式：${exp.mode} · 素材：${exp.setName}
- 总时长：${exp.durationSec != null ? exp.durationSec.toFixed(1) + ' 秒' : '—'}（有效有声：${exp.voicedSec != null ? exp.voicedSec.toFixed(1) + ' 秒' : '—'}，发声比率：${exp.voicedPct != null ? exp.voicedPct + '%' : '—'}）
${exp.stamp ? `- 体感印章：${formatStampSummary(exp.stamp)}\n` : ''}

## 客观声学指标
| 类别 | 参数 | 实测值 | 参考区间 | 测量口径注 |
| :--- | :--- | :--- | :--- | :--- |
| **基频音高** | 中位基频 F0 | ${exp.f0.median ? Math.round(exp.f0.median) + ' Hz' : '未测出'} | 145~175 Hz (过渡) / >175 Hz (女声) | YIN，置信度 ≥0.58 |
| | 平均基频 Mean F0 | ${exp.f0.mean ? Math.round(exp.f0.mean) + ' Hz' : '未测出'} | — | 有效帧代数平均 |
| | 稳定带 P10 ~ P90 | ${exp.f0.p10 && exp.f0.p90 ? `${Math.round(exp.f0.p10)} ~ ${Math.round(exp.f0.p90)} Hz` : '未测出'} | — | 截断两端极值抗爆音 |
| | 音高起伏跨度 | ${exp.f0.spanSt != null ? exp.f0.spanSt.toFixed(1) + ' 半音' : '未测出'} | 日常 3.0 ~ 6.0 半音 (长句 5~8) | P10–P90 跨度，剔除句尾淡出 |
| | 音区分布 | 低 ${exp.f0.maleZonePct ?? 0}% / 中 ${exp.f0.midZonePct ?? 0}% / 高 ${exp.f0.femaleZonePct ?? 0}% | — | 男声<145 / 过渡145~175 / 女声>175 |
| **声带振动** | 声门开商 H1−H2 | ${exp.weight.h1h2 != null ? exp.weight.h1h2.toFixed(1) + ' dB' : '未检出'} | ≤−1.2 偏紧；-0.5~3.5 舒展流动 | 带 F1 共振峰污染守卫 |
| | 周期微扰 Jitter | ${exp.weight.jitter != null ? exp.weight.jitter.toFixed(2) + ' %' : '未测出'} | 语流 1.8 ~ 2.8 % | 连续语流不可与长音常模比 |
| | 振幅扰动 Shimmer | ${exp.weight.shimmer != null ? exp.weight.shimmer.toFixed(2) + ' %' : '未测出'} | 连续口语 ≤ 8.0 % | 日常口语重音起伏自然偏高 |
| | 谐噪比 HNR | ${exp.weight.hnr != null ? exp.weight.hnr.toFixed(1) + ' dB' : '未测出'} | ≥ 12.0 dB 清澈 | 自相关峰值归一化 |
| | 假声折半比 Halving | ${exp.weight.halving != null ? exp.weight.halving.toFixed(1) + ' %' : '未检出'} | 持续长音通常 < 5 % | 连续语流偶发边缘振动 |
| **共鸣声道** | 共振峰间距 ΔF | ${exp.resonance.deltaF ? Math.round(exp.resonance.deltaF) + ' Hz' : '未测出'} | 约 1000 ~ 1250 Hz | 仅在「衣」音提取，LPC Burg |
| | 共振峰 F1 / F2 | ${exp.resonance.f1 && exp.resonance.f2 ? `${Math.round(exp.resonance.f1)} / ${Math.round(exp.resonance.f2)} Hz` : '未测出'} | — | F1 开度，F2 舌位前后 |
| **声调控制** | 安全托底率 | ${exp.tone.floorSafeRatio != null ? exp.tone.floorSafeRatio + '%' : '未测出'} | 推荐 ≥ 85% | 托底线 ${exp.tone.floorTargetHz || 160} Hz 以上有声时间比 |
| | 气泡音比率 | ${exp.tone.creakRatio != null ? (exp.tone.creakRatio * 100).toFixed(1) + '%' : '未测出'} | < 15 % | 降调到底部时的声门失锁 |
${exp.fricative.centroidHz != null ? `| **摩擦音** | 咝音重心 (/s/) | ${(exp.fricative.centroidHz / 1000).toFixed(2)} kHz | 6.0 ~ 8.5 kHz | 4kHz以上高频占优帧频谱重心 |\n` : ''}
`;
}

/**
 * 生成多段合并对比 Markdown (docs/60 §3)
 * @param {object[]} takes 录音记录数组
 * @returns {string} Markdown
 */
export function renderBatchMarkdown(takes) {
  if (!takes || !takes.length) return '';

  const exportList = takes.map((t) => toExport(t)).sort((a, b) => a.ts - b.ts);
  const count = exportList.length;

  // 构造可比性判定辅助
  function getComparisonTag(cur, idx, arr) {
    if (idx === 0) return '基准记录';
    const prev = arr[idx - 1];
    if (cur.setName === prev.setName && cur.mode === prev.mode) {
      return `与第 ${idx} 段同素材同模式，可直接横向对比`;
    }
    return `与第 ${idx} 段素材不同，建议仅看整体趋势`;
  }

  // 构造对比表格
  const tableRows = exportList.map((e, idx) => {
    const f0Str = e.f0.median ? `${Math.round(e.f0.median)} Hz` : '—';
    const spanStr = e.f0.spanSt != null ? `${e.f0.spanSt.toFixed(1)} st` : '—';
    const h1h2Str = e.weight.h1h2 != null ? `${e.weight.h1h2.toFixed(1)} dB` : '—';
    const deltaFStr = e.resonance.deltaF ? `${Math.round(e.resonance.deltaF)} Hz` : '—';
    const floorStr = e.tone.floorSafeRatio != null ? `${e.tone.floorSafeRatio}%` : '—';
    const compTag = getComparisonTag(e, idx, exportList);

    return `| ${idx + 1} | ${e.tsLocal} | ${e.setName} | ${f0Str} | ${spanStr} | ${h1h2Str} | ${deltaFStr} | ${floorStr} | ${compTag} |`;
  }).join('\n');

  // 构造各单段明细
  const detailsSections = exportList.map((e, idx) => {
    return `### 第 ${idx + 1} 段 · ${e.tsLocal} · ${e.setName} (${e.durationSec != null ? e.durationSec.toFixed(1) + 's' : '—'})
${e.stamp ? `- 体感印章：${formatStampSummary(e.stamp)}\n` : ''}- 有效发声时长：${e.voicedSec != null ? e.voicedSec.toFixed(1) + ' 秒' : '—'}（占比 ${e.voicedPct != null ? e.voicedPct + '%' : '—'}）
- 中位基频：${e.f0.median ? Math.round(e.f0.median) + ' Hz (' + pitchName(e.f0.median) + ')' : '—'} · 音高起伏：${e.f0.spanSt != null ? e.f0.spanSt.toFixed(1) + ' 半音' : '—'}
- 轻音重 H1−H2：${e.weight.h1h2 != null ? e.weight.h1h2.toFixed(1) + ' dB' : '未检出'} · 共鸣间距 ΔF：${e.resonance.deltaF ? Math.round(e.resonance.deltaF) + ' Hz' : '未测出'}
- 周期微扰 Jitter：${e.weight.jitter != null ? e.weight.jitter.toFixed(2) + '%' : '—'} · 振幅扰动 Shimmer：${e.weight.shimmer != null ? e.weight.shimmer.toFixed(2) + '%' : '—'}
${e.fricative.centroidHz != null ? `- 咝音摩擦重心：${(e.fricative.centroidHz / 1000).toFixed(2)} kHz\n` : ''}`;
  }).join('\n---\n\n');

  return `<!-- qinglai-export v1 · format:batch · count:${count} · algoVersion:${ALGO_VERSION} · kbVersion:${KB_VERSION} -->
# 电波日记 · 发声记录汇总 (${count} 段)

> 说明：本文档包含 ${count} 次客观发声测量数据，按时间先后顺序排列。  
> 口径速记：F0 为有声帧中位数；起伏为 P10–P90 半音跨度；ΔF 仅取 /i/ 帧（1000–1250 Hz）；H1−H2 负值偏紧、0 附近为轻音重；  
> 比较原则：同素材同模式可直接比较数值差异；不同素材建议仅对比音重与共鸣趋势。

## 多次发声综合对比表
| # | 记录时间 | 练习素材 | 中位 F0 | 音高起伏 | H1−H2 | 共鸣 ΔF | 托底率 | 可比性判定 |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${tableRows}

## 各段详细声学记录
${detailsSections}
`;
}

/**
 * 保存或导出 Markdown 文件到手机或本地
 * 支持原生 Android 桥接、Web Share API 及浏览器下载降级
 * @param {string} content Markdown 文本内容
 * @param {string} fileName 保存文件名 (如 电波日记_20261114_1720_声音日记.md)
 * @returns {Promise<{ shared: boolean, downloaded: boolean, path?: string, fileName: string }>}
 */
export async function saveMarkdownFile(content, fileName) {
  // UTF-8 BOM 确保 Windows 记事本、Typora、手机阅读器打开绝不乱码
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(content);
  const blob = new Blob([bom, textBytes], { type: 'text/markdown;charset=utf-8' });

  // 1. Android 原生宿主环境优先（window.DshFile 存在说明在 Android App 内）
  if (typeof window !== 'undefined' && window.DshFile) {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result;
          const commaIdx = res.indexOf(',');
          resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const b64 = await base64Promise;

      let resPath = null;
      if (typeof window.DshFile.saveFile === 'function') {
        resPath = window.DshFile.saveFile(fileName, b64, 'text/markdown');
      } else if (typeof window.DshFile.saveBase64 === 'function') {
        resPath = window.DshFile.saveBase64(fileName, b64);
      }
      if (resPath && !resPath.startsWith('ERR:')) {
        return { shared: true, downloaded: true, path: resPath, fileName };
      }
    } catch (e) {
      console.warn('[export] 原生 DshFile 保存 markdown 失败，尝试降级:', e);
    }
  }

  // 2. 外部浏览器环境：尝试 Web Share API
  if (typeof navigator !== 'undefined' && navigator.canShare && window.File) {
    try {
      const file = new File([blob], fileName, { type: 'text/markdown;charset=utf-8' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
          text: '电波日记发声测量记录',
        });
        return { shared: true, downloaded: false, fileName };
      }
    } catch (shareErr) {
      if (shareErr.name === 'AbortError') return { cancelled: true, fileName };
    }
  }

  // 3. 浏览器普通下载兜底
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { shared: false, downloaded: true, fileName };
}

/**
 * 快捷导出单次记录为 Markdown 文件
 * @param {object} take
 * @param {'diary'|'consultation'} [format='diary']
 * @returns {Promise<object>}
 */
export async function exportTakeMarkdown(take, { format = 'diary' } = {}) {
  if (!take) throw new Error('没有可导出的记录数据。');
  const d = new Date(take.ts || Date.now());
  const dateStr = formatFileStamp(d);
  const rawName = take.setName
    ? take.setName.replace(/[\\/:*?"<>|]/g, '_').trim()
    : (take.mode === 'free' ? '自由表达' : '发声练习');

  const suffix = format === 'consultation' ? '咨询包' : '声音日记';
  const fileName = `电波日记_${dateStr}_${rawName}_${suffix}.md`;

  const mdContent = format === 'consultation'
    ? renderConsultationMarkdown(take)
    : renderDiaryMarkdown(take);

  return saveMarkdownFile(mdContent, fileName);
}

/**
 * 快捷导出多条记录为合并 Markdown 文件
 * @param {object[]} takes
 * @returns {Promise<object>}
 */
export async function exportBatchMarkdown(takes) {
  if (!takes || !takes.length) throw new Error('请至少选择一条记录进行导出。');
  const dateStr = formatFileStamp(Date.now());
  const fileName = `电波日记_${dateStr}_批量汇总(${takes.length}段).md`;
  const mdContent = renderBatchMarkdown(takes);
  return saveMarkdownFile(mdContent, fileName);
}
