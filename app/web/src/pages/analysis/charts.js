/* ===========================================================
   analysis/charts.js — v2.0 Soft Crayon 图表绘制、AI 问诊词与 WAV 导出
   所有声学评估经由 ../../core/index.js 调用
   =========================================================== */

import { pitchName, renderConsultationMarkdown } from '../../core/index.js';

const css = (k, fb) => (typeof window !== 'undefined' && window.cssVar ? window.cssVar(k, fb) : fb);

function fmtSigned(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;
}

/**
 * 第一层卡 A：独立的 2D/1D 音色位置图（DSH 62 §4 · 声门轻重 × 共鸣空间 + 误差椭圆）
 */
export function paintTimbrePosition(canvas, ns) {
  if (!canvas || !ns) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(260, Math.round(rect.width || canvas.clientWidth || 320));
  const h = Math.max(196, Math.round(rect.height || canvas.clientHeight || 208));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const ink1 = css('--ink-1', '#242B35');
  const ink2 = css('--ink-2', '#526071');
  const ink3 = css('--ink-3', '#8795A6');
  const gridCol = css('--chart-grid', 'rgba(82, 96, 113, 0.16)');
  const paperSoft = css('--paper-3', '#F4F6F9');
  const paperCard = css('--paper-card', '#FFFFFF');
  const quadBgA = css('--quad-bg-a', '#FFF5F2');
  const quadBgB = css('--quad-bg-b', '#FFF9EC');
  const coral = css('--crayon-coral', '#E27370');
  const coralSoft = css('--crayon-coral-soft', 'rgba(226, 115, 112, 0.18)');
  const amber = css('--crayon-amber', '#E8A852');
  const amberSoft = css('--crayon-amber-soft', 'rgba(232, 168, 82, 0.22)');
  const lavender = css('--crayon-lavender', '#8A86C8');
  const lavenderSoft = css('--crayon-lavender-soft', 'rgba(138, 134, 200, 0.16)');
  const mint = css('--crayon-mint', '#6EB5AF');
  const mintSoft = css('--crayon-mint-soft', 'rgba(110, 181, 175, 0.20)');
  const sky = css('--crayon-sky', '#6699CC');
  const skySoft = css('--crayon-sky-soft', 'rgba(102, 153, 204, 0.18)');

  const q = ns.quadrant || {};
  const mode = q.mode || 'none';

  if (mode === 'none') {
    ctx.fillStyle = paperSoft;
    ctx.beginPath();
    ctx.roundRect(8, 12, w - 16, h - 24, 16);
    ctx.fill();
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = ink3;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const msg = q.isHum
      ? '闭口哼鸣不参与音色二维定位（无口腔元音共振峰）'
      : '有效浊音元音不足 · 暂未绘制位置点';
    ctx.fillText(msg, w / 2, h / 2);
    return;
  }

  if (mode === '1d-weight' || mode === '1d-size') {
    const isW = mode === '1d-weight';
    const boxL = 10;
    const boxR = w - 10;
    const boxT = 16;
    const boxB = h - 18;
    ctx.fillStyle = paperSoft;
    ctx.beginPath();
    ctx.roundRect(boxL, boxT, boxR - boxL, boxB - boxT, 16);
    ctx.fill();
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = ink2;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(isW ? '单维定位 · 声门轻重 (H1-H2)' : '单维定位 · 前口腔共鸣尺寸', boxL + 16, boxT + 14);

    const trackL = boxL + 22;
    const trackR = boxR - 22;
    const trackW = trackR - trackL;
    const trackMid = (trackL + trackR) / 2;
    const trackY = boxT + (boxB - boxT) * 0.48;

    // 滑轨底槽
    ctx.fillStyle = gridCol;
    ctx.beginPath();
    ctx.roundRect(trackL, trackY - 5, trackW, 10, 5);
    ctx.fill();

    // 温和参考区（非达标线）
    const bandL = trackMid + (isW ? -0.15 : -0.12) * (trackW / 2 - 12);
    const bandR = trackMid + (isW ? 0.45 : 0.45) * (trackW / 2 - 12);
    ctx.fillStyle = mintSoft;
    ctx.beginPath();
    ctx.roundRect(bandL, trackY - 7, bandR - bandL, 14, 7);
    ctx.fill();

    // 中线刻痕
    ctx.strokeStyle = ink3;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(trackMid, trackY - 14);
    ctx.lineTo(trackMid, trackY + 14);
    ctx.stroke();
    ctx.setLineDash([]);

    // 两端语义标签
    ctx.fillStyle = ink3;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(isW ? '← 偏实偏紧' : '← 声道宽深', trackL, trackY - 12);
    ctx.textAlign = 'right';
    ctx.fillText(isW ? '轻柔舒展 →' : '前口腔明亮 →', trackR, trackY - 12);

    const rawVal = isW ? (q.weightX ?? 0) : (q.sizeY ?? 0);
    const errVal = isW ? (q.errX ?? 0.28) : (q.errY ?? 0.2);
    const usableHalf = trackW / 2 - 12;
    const dotX = trackMid + rawVal * usableHalf;
    const errPx = Math.max(12, errVal * usableHalf);

    // 误差范围胶囊
    ctx.fillStyle = isW ? lavenderSoft : skySoft;
    ctx.beginPath();
    ctx.roundRect(Math.max(trackL, dotX - errPx), trackY - 12, Math.min(errPx * 2, trackR - Math.max(trackL, dotX - errPx)), 24, 12);
    ctx.fill();
    ctx.strokeStyle = isW ? lavender : sky;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 实测位置圆点
    const dotColor = (ns.isPressed || ns.isDuckVoice) ? coral : (isW ? lavender : sky);
    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(dotX, trackY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = paperCard;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = ink2;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      isW
        ? '缺前口腔参照点，已自动降级一维展示（虚框为跨实现估计误差带）'
        : '缺长「啊」音开商参照，已自动降级一维展示（虚框为测量误差带）',
      trackMid,
      trackY + 26
    );
    return;
  }

  // mode === '2d'
  const qLeft = 14;
  const qRight = w - 14;
  const qTop = 26;
  const qBottom = h - 26;
  const qW = Math.max(140, qRight - qLeft);
  const qH = Math.max(110, qBottom - qTop);
  const qMidX = qLeft + qW / 2;
  const qMidY = qTop + qH / 2;

  const qGrad = ctx.createLinearGradient(qLeft, qBottom, qRight, qTop);
  qGrad.addColorStop(0, quadBgB);
  qGrad.addColorStop(1, quadBgA);
  ctx.fillStyle = qGrad;
  ctx.beginPath();
  ctx.roundRect(qLeft, qTop, qW, qH, 16);
  ctx.fill();
  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 1;
  ctx.stroke();

  const usableHalfW = Math.max(24, qW / 2 - 22);
  const usableHalfH = Math.max(20, qH / 2 - 18);

  // 非诊断浅色虚框参考区（轻柔平衡 × 明亮偏上）
  const refX1 = qMidX - 0.15 * usableHalfW;
  const refX2 = qMidX + 0.55 * usableHalfW;
  const refY1 = qMidY - 0.55 * usableHalfH;
  const refY2 = qMidY + 0.15 * usableHalfH;
  ctx.fillStyle = mintSoft;
  ctx.beginPath();
  ctx.roundRect(refX1, refY1, refX2 - refX1, refY2 - refY1, 10);
  ctx.fill();
  ctx.strokeStyle = mint;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = ink3;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('参考平衡区（非达标线）', (refX1 + refX2) / 2, refY1 + 5);

  // 坐标中轴线
  ctx.strokeStyle = ink3;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(qMidX, qTop + 10);
  ctx.lineTo(qMidX, qBottom - 10);
  ctx.moveTo(qLeft + 12, qMidY);
  ctx.lineTo(qRight - 12, qMidY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 纵轴标题（箱外上下，防遮挡）
  ctx.fillStyle = ink2;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('↑ 前口腔明亮紧凑 (ΔF / 元音尺度)', qMidX, qTop - 6);
  ctx.textBaseline = 'top';
  ctx.fillText('↓ 声道宽沉温润', qMidX, qBottom + 6);

  // 横轴两侧语义
  ctx.fillStyle = ink2;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText('← 偏实偏紧', qLeft + 10, qMidY - 5);
  ctx.textAlign = 'right';
  ctx.fillText('轻柔舒展 (H1-H2) →', qRight - 10, qMidY - 5);

  const wx = q.weightX ?? 0;
  const sy = q.sizeY ?? 0;
  const dotX = qMidX + wx * usableHalfW;
  const dotY = qMidY - sy * usableHalfH;
  const rx = Math.max(10, (q.errX ?? 0.28) * usableHalfW);
  const ry = Math.max(10, (q.errY ?? 0.16) * usableHalfH);

  // 实测误差椭圆（DSH 62 §4.1）
  const isTight = ns.isPressed || ns.isDuckVoice;
  const inIdeal = wx >= 0.18;
  ctx.fillStyle = isTight ? coralSoft : (inIdeal ? mintSoft : lavenderSoft);
  ctx.beginPath();
  ctx.ellipse(dotX, dotY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isTight ? coral : (inIdeal ? mint : lavender);
  ctx.lineWidth = 1.1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 中心定位点
  ctx.fillStyle = isTight ? coral : (inIdeal ? mint : lavender);
  ctx.beginPath();
  ctx.arc(dotX, dotY, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = paperCard;
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

/**
 * 第一层卡 B：独立柱状图（共振峰 f0·F1~F3 与谐波 H1~H5 切换，无跨图连线）
 */
export function paintSpectrumOrFormants(canvas, ns, mode = 'formants') {
  if (!canvas || !ns) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(260, Math.round(rect.width || canvas.clientWidth || 320));
  const h = Math.max(182, Math.round(rect.height || canvas.clientHeight || 192));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const ink1 = css('--ink-1', '#242B35');
  const ink2 = css('--ink-2', '#526071');
  const ink3 = css('--ink-3', '#8795A6');
  const gridCol = css('--chart-grid', 'rgba(82, 96, 113, 0.16)');
  const outlineCol = css('--bar-outline', '#4F5E72');
  const paperCard = css('--paper-card', '#FFFFFF');

  const crayonCols = [
    css('--crayon-coral', '#E27370'),
    css('--crayon-amber', '#E8A852'),
    css('--crayon-mint', '#6EB5AF'),
    css('--crayon-sky', '#6699CC'),
    css('--crayon-indigo', '#4F6F96'),
  ];

  const padL = 16;
  const padR = 16;
  const chartTop = 32;
  const baseBottom = h - 34;
  const chartH = baseBottom - chartTop;
  const areaW = w - padL - padR;

  // 背景轻基线与虚线引导
  for (const frac of [0.33, 0.66]) {
    const y = baseBottom - frac * chartH;
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = ink3;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(padL, baseBottom);
  ctx.lineTo(w - padR, baseBottom);
  ctx.stroke();

  if (mode === 'harmonics') {
    let rel = Array.isArray(ns.harmonicsRelDb) && ns.harmonicsRelDb.length === 5
      ? ns.harmonicsRelDb
      : null;
    if (!rel && Array.isArray(ns.harmonicsDb) && ns.harmonicsDb.length === 5 && ns.harmonicsDb[0] != null) {
      rel = ns.harmonicsDb.map((v) => (v != null ? Number((v - ns.harmonicsDb[0]).toFixed(1)) : null));
    }
    if (!rel && Array.isArray(ns.harmonicsBars) && ns.harmonicsBars.length === 5) {
      rel = ns.harmonicsBars.map((v) => Number((v - ns.harmonicsBars[0]).toFixed(1)));
    }

    ctx.fillStyle = ink3;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('相对 H1 能量 (dB)', w - padR, 6);

    if (!rel) {
      ctx.fillStyle = ink3;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('有效浊音元音不足 · 暂未提取 H1~H5 谐波', w / 2, (chartTop + baseBottom) / 2);
      return;
    }

    const valid = rel.filter((v) => v != null && Number.isFinite(v));
    const minDb = Math.min(-26, ...(valid.length ? valid : [0]));
    const maxDb = Math.max(6, ...(valid.length ? valid : [0]));
    const span = Math.max(12, maxDb - minDb);

    const colGap = areaW / 5;
    const barW = Math.min(34, Math.max(18, colGap * 0.56));
    for (let i = 0; i < 5; i++) {
      const val = rel[i];
      const cx = padL + colGap * (i + 0.5);
      const x = cx - barW / 2;

      if (val == null || !Number.isFinite(val)) {
        const bh = chartH * 0.36;
        ctx.strokeStyle = ink3;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.roundRect(x, baseBottom - bh, barW, bh, [8, 8, 3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const norm = Math.max(0.14, Math.min(0.95, (val - minDb) / span));
        const bh = norm * chartH;
        const y = baseBottom - bh;
        ctx.fillStyle = crayonCols[i];
        ctx.beginPath();
        ctx.roundRect(x, y, barW, bh, [10, 10, 3, 3]);
        ctx.fill();
        ctx.strokeStyle = outlineCol;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        const badgeY = Math.max(18, y - 13);
        ctx.fillStyle = crayonCols[i];
        ctx.beginPath();
        ctx.roundRect(cx - 17, badgeY - 9, 34, 17, 8);
        ctx.fill();
        ctx.fillStyle = paperCard;
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const txt = i === 0 ? '0' : `${val > 0 ? '+' : ''}${Math.round(val)}`;
        ctx.fillText(txt, cx, badgeY);
      }

      ctx.fillStyle = ink1;
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`H${i + 1}`, cx, baseBottom + 8);
    }
    return;
  }

  // mode === 'formants' (f0, F1, F2, F3 蜡笔柱图)
  const vI = ns.byVowel?.i || null;
  const items = [
    {
      label: 'f0 基频',
      sub: '声带振动',
      val: ns.medianF0,
      min: 80,
      max: 290,
      ref: 185,
      color: crayonCols[0],
    },
    {
      label: 'F1 开合',
      sub: vI?.f1 ? '「衣」音' : '均值',
      val: vI?.f1 ?? ns.f1,
      min: 200,
      max: 920,
      ref: vI?.f1 ? 370 : 520,
      color: crayonCols[1],
    },
    {
      label: 'F2 前后',
      sub: vI?.f2 ? '「衣」音' : '均值',
      val: vI?.f2 ?? ns.f2,
      min: 700,
      max: 2950,
      ref: vI?.f2 ? 2550 : 1850,
      color: crayonCols[2],
    },
    {
      label: 'F3 光泽',
      sub: '口腔前部',
      val: ns.f3,
      min: 1900,
      max: 3500,
      ref: 2850,
      color: crayonCols[3],
    },
  ];

  ctx.fillStyle = ink3;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('虚线为常见柔亮参考刻度 (Hz)', w - padR, 6);

  const colGap = areaW / items.length;
  const barW = Math.min(40, Math.max(22, colGap * 0.54));

  items.forEach((it, idx) => {
    const cx = padL + colGap * (idx + 0.5);
    const x = cx - barW / 2;

    if (it.val == null || !Number.isFinite(it.val)) {
      const bh = chartH * 0.42;
      const y = baseBottom - bh;
      ctx.strokeStyle = ink3;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.roundRect(x, y, barW, bh, [10, 10, 3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = ink3;
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('待测', cx, y + bh / 2);
    } else {
      const ratio = Math.max(0.14, Math.min(0.95, (it.val - it.min) / (it.max - it.min)));
      const bh = ratio * chartH;
      const y = baseBottom - bh;

      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, bh, [10, 10, 3, 3]);
      ctx.fill();
      ctx.strokeStyle = outlineCol;
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // 参考目标虚刻度线
      const refRatio = Math.max(0.14, Math.min(0.95, (it.ref - it.min) / (it.max - it.min)));
      const refY = baseBottom - refRatio * chartH;
      ctx.strokeStyle = ink1;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(x - 4, refY);
      ctx.lineTo(x + barW + 4, refY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 顶部数值胶囊
      const badgeY = Math.max(18, y - 12);
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.roundRect(cx - 21, badgeY - 9, 42, 17, 8);
      ctx.fill();
      ctx.fillStyle = paperCard;
      ctx.font = '700 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(it.val)}`, cx, badgeY);
    }

    ctx.fillStyle = ink1;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(it.label, cx, baseBottom + 6);

    ctx.fillStyle = ink3;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(it.sub, cx, baseBottom + 20);
  });
}

/**
 * 第一层主视觉：H1~H5 粉蜡笔谐波柱状图 + 联动折线弧 + 2D 圆角音色象限
 * X 轴：更深沉 (-1) <-> 更明亮 (+1)；Y 轴：更轻柔 (-1) <-> 偏实/紧 (+1)
 */
export function paintHarmonicsAndQuadrant(canvas, ns) {
  if (!canvas || !ns) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(280, Math.round(rect.width || canvas.clientWidth || 340));
  const h = Math.max(210, Math.round(rect.height || canvas.clientHeight || 226));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const ink1 = css('--ink-1', '#242B35');
  const ink2 = css('--ink-2', '#526071');
  const ink3 = css('--ink-3', '#8795A6');
  const gridCol = css('--chart-grid', 'rgba(82, 96, 113, 0.16)');
  const outlineCol = css('--bar-outline', '#4F5E72');
  const quadBgA = css('--quad-bg-a', '#FFF5F2');
  const quadBgB = css('--quad-bg-b', '#FFF9EC');
  const paperCard = css('--paper-card', '#FFFFFF');
  const mintSoft = css('--crayon-mint-soft', 'rgba(110, 181, 175, 0.18)');
  const mint = css('--crayon-mint', '#6EB5AF');
  const coralSoft = css('--crayon-coral-soft', 'rgba(226, 115, 112, 0.22)');
  const lavender = css('--crayon-lavender', '#8A86C8');
  const lavenderSoft = css('--crayon-lavender-soft', 'rgba(138, 134, 200, 0.16)');

  const crayonCols = [
    css('--crayon-coral', '#E27370'),
    css('--crayon-amber', '#E8A852'),
    css('--crayon-mint', '#6EB5AF'),
    css('--crayon-sky', '#6699CC'),
    css('--crayon-indigo', '#4F6F96'),
  ];

  // 左区：H1~H5 粉蜡笔谐波柱状图
  const leftPad = 26;
  const baseBottom = h - 24;
  const chartTop = 26;
  const chartH = baseBottom - chartTop;
  const leftWidth = Math.round(w * 0.44);
  const scaleMax = 72;

  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const tick of [20, 40, 60]) {
    const y = baseBottom - (tick / scaleMax) * chartH;
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(leftPad, y);
    ctx.lineTo(leftPad + leftWidth, y);
    ctx.stroke();
    ctx.fillStyle = ink3;
    ctx.fillText(String(tick), leftPad - 6, y);
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = ink3;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(leftPad, baseBottom);
  ctx.lineTo(leftPad + leftWidth, baseBottom);
  ctx.stroke();

  // 右区：2D 圆角音色象限
  const qLeft = Math.round(w * 0.54);
  const qRight = w - 6;
  const qW = Math.max(110, qRight - qLeft);
  const qTop = 10;
  const qBottom = h - 18;
  const qH = qBottom - qTop;
  const qMidX = qLeft + qW / 2;
  const qMidY = qTop + qH / 2;

  const qGrad = ctx.createLinearGradient(qLeft, qTop, qLeft, qBottom);
  qGrad.addColorStop(0, quadBgA);
  qGrad.addColorStop(1, quadBgB);
  ctx.fillStyle = qGrad;
  ctx.beginPath();
  ctx.roundRect(qLeft, qTop, qW, qH, 16);
  ctx.fill();
  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 1;
  ctx.stroke();

  const usableHalfW = Math.max(20, qW / 2 - 24);
  const usableHalfH = Math.max(20, qH / 2 - 34);

  // 右下轻盈平衡参考浅区（更明亮 + 适度轻柔）
  const refL = qMidX + 0.05 * usableHalfW;
  const refR = qMidX + 0.72 * usableHalfW;
  const refT = qMidY + 0.05 * usableHalfH;
  const refB = qMidY + 0.72 * usableHalfH;
  ctx.fillStyle = mintSoft;
  ctx.beginPath();
  ctx.roundRect(refL, refT, refR - refL, refB - refT, 8);
  ctx.fill();
  ctx.strokeStyle = mint;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 十字坐标线
  ctx.strokeStyle = ink3;
  ctx.lineWidth = 1.1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(qMidX, qTop + 20);
  ctx.lineTo(qMidX, qBottom - 20);
  ctx.moveTo(qLeft + 8, qMidY);
  ctx.lineTo(qRight - 8, qMidY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 象限方向文字
  ctx.fillStyle = ink2;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('偏实 / 紧', qMidX, qTop + 5);
  ctx.textBaseline = 'bottom';
  ctx.fillText('更轻柔', qMidX, qBottom - 5);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('更深沉', qLeft + 7, qMidY - 4);
  ctx.textAlign = 'right';
  ctx.fillText('更明亮', qRight - 7, qMidY - 4);

  // 由谐波绝对能量/相对能量推算 5 根视觉柱高
  let bars = null;
  if (Array.isArray(ns.harmonicsDb) && ns.harmonicsDb.length === 5 && ns.harmonicsDb.every(Number.isFinite)) {
    const peak = Math.max(...ns.harmonicsDb);
    bars = ns.harmonicsDb.map((v) => Math.max(8, Math.min(68, Math.round(46 + (v - peak) * 1.15))));
  } else if (Array.isArray(ns.harmonicsRelDb) && ns.harmonicsRelDb.length === 5 && ns.harmonicsRelDb.every(Number.isFinite)) {
    const peak = Math.max(...ns.harmonicsRelDb);
    bars = ns.harmonicsRelDb.map((v) => Math.max(8, Math.min(68, Math.round(46 + (v - peak) * 1.15))));
  } else if (Array.isArray(ns.harmonicsBars) && ns.harmonicsBars.length === 5) {
    bars = ns.harmonicsBars;
  }

  const q = ns.quadrant || {};
  if (!bars || q.mode === 'none' || q.isHum) {
    const colGap = leftWidth / 5;
    const barW = Math.min(22, colGap * 0.62);
    for (let i = 0; i < 5; i++) {
      const cx = leftPad + colGap * (i + 0.5);
      const bh = 28 + (4 - i) * 7;
      ctx.fillStyle = gridCol;
      ctx.beginPath();
      ctx.roundRect(cx - barW / 2, baseBottom - bh, barW, bh, [8, 8, 2, 2]);
      ctx.fill();
      ctx.fillStyle = ink3;
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`H${i + 1}`, cx, baseBottom + 6);
    }
    ctx.fillStyle = ink3;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(q.isHum ? '闭口哼鸣不参与象限' : '浊音样本偏短，暂未定位', qMidX, qMidY);
    return;
  }

  // 绘制 5 根粉蜡笔柱体（第 1 层：柱体与底部标签）
  const colGap = leftWidth / 5;
  const barW = Math.min(24, Math.max(14, colGap * 0.60));
  const barTops = [];

  for (let i = 0; i < 5; i++) {
    const val = bars[i];
    const ratio = Math.max(0.10, Math.min(0.98, val / scaleMax));
    const bh = ratio * chartH;
    const cx = leftPad + colGap * (i + 0.5);
    const x = cx - barW / 2;
    const y = baseBottom - bh;
    barTops.push({ x: cx, y, val });

    ctx.fillStyle = crayonCols[i];
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, [9, 9, 3, 3]);
    ctx.fill();

    ctx.strokeStyle = outlineCol;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = ink1;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`H${i + 1}`, cx, baseBottom + 6);
  }

  // 第 2 层：仅在左侧 H1~H5 柱顶之间的轻柔衰减参考弧线（不跨向右图、不遮挡数字徽章）
  if (barTops.length === 5) {
    const decayGrad = ctx.createLinearGradient(barTops[0].x, 0, barTops[4].x, 0);
    decayGrad.addColorStop(0, crayonCols[0]);
    decayGrad.addColorStop(0.5, crayonCols[2]);
    decayGrad.addColorStop(1, crayonCols[4]);
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = decayGrad;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(barTops[0].x, barTops[0].y - 3);
    for (let i = 0; i < barTops.length - 1; i++) {
      const curr = barTops[i];
      const next = barTops[i + 1];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2 - 3;
      ctx.quadraticCurveTo(curr.x, curr.y - 3, midX, midY);
    }
    ctx.lineTo(barTops[4].x, barTops[4].y - 3);
    ctx.stroke();
    ctx.restore();
  }

  // 第 3 层：柱顶数值徽章（始终压在弧线之上，保证清晰可读）
  for (let i = 0; i < 5; i++) {
    const { x: cx, y, val } = barTops[i];
    const badgeY = Math.max(12, y - 13);
    ctx.fillStyle = crayonCols[i];
    ctx.beginPath();
    ctx.roundRect(cx - 12, badgeY - 8, 24, 16, 8);
    ctx.fill();

    ctx.fillStyle = paperCard;
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.round(val)), cx, badgeY + 0.5);
  }

  const qxVal = q.x ?? 0;
  const qyVal = q.y ?? 0;
  const dotX = qMidX + qxVal * usableHalfW;
  const dotY = qMidY - qyVal * usableHalfH; // +y 偏实(上), -y 更轻柔(下)

  // 若缺其中一轴，画出对应轴虚线范围条带提示“该维待测”
  if (q.y == null && q.x != null) {
    ctx.strokeStyle = ink3;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(dotX, qTop + 26);
    ctx.lineTo(dotX, qBottom - 26);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (q.x == null && q.y != null) {
    ctx.strokeStyle = ink3;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(qLeft + 18, dotY);
    ctx.lineTo(qRight - 18, dotY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 实测误差光晕 + 中心实心圆点（温和提示采用雾霭紫蓝，仅压喉/挤卡保留珊瑚粉）
  const isPressedAlert = ns.isPressed || ns.isDuckVoice;
  const inBrightSoftZone = qxVal >= 0.15 && qyVal <= 0.1;
  const rx = Math.min(22, Math.max(12, (q.errX ?? 0.22) * usableHalfW * 0.7));
  const ry = Math.min(20, Math.max(12, (q.errY ?? 0.28) * usableHalfH * 0.65));
  ctx.fillStyle = isPressedAlert ? coralSoft : (inBrightSoftZone ? mintSoft : lavenderSoft);
  ctx.beginPath();
  ctx.ellipse(dotX, dotY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  const dotColor = isPressedAlert ? crayonCols[0] : (inBrightSoftZone ? mint : lavender);
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = paperCard;
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

/**
 * 折叠详情区：音高变化曲线 + 嘎裂点标示 + 托底参考线
 */
export function paintPitchTrack(canvas, take, floorHz = 160) {
  if (!canvas || !take) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(260, Math.round(rect.width || canvas.clientWidth || 320));
  const h = 156;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const paperSoft = css('--paper-3', '#F4F6F9');
  const ink3 = css('--ink-3', '#8795A6');
  const mintSoft = css('--crayon-mint-soft', 'rgba(110, 181, 175, 0.16)');
  const mint = css('--crayon-mint', '#6EB5AF');
  const sky = css('--crayon-sky', '#6699CC');
  const coral = css('--crayon-coral', '#E27370');
  const gridCol = css('--chart-grid', 'rgba(82, 96, 113, 0.15)');

  ctx.fillStyle = paperSoft;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 14);
  ctx.fill();

  const pts = Array.isArray(take.curve) ? take.curve : [];
  if (!pts.length) {
    ctx.fillStyle = ink3;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('没有足够的有效音高点绘制曲线', w / 2, h / 2);
    return;
  }

  const padL = 38;
  const padR = 12;
  const padT = 14;
  const padB = 22;
  const pw = w - padL - padR;
  const ph = h - padT - padB;
  const minHz = 95;
  const peakPtHz = pts.reduce((m, p) => Math.max(m, p[1] || 0), 0);
  const maxHz = Math.max(300, Math.min(390, Math.ceil((peakPtHz + 15) / 10) * 10));
  const tMax = Math.max(1, pts[pts.length - 1][0] || 1);

  const toX = (t) => padL + (t / tMax) * pw;
  const toY = (hz) => padT + ph * (1 - (Math.max(minHz, Math.min(maxHz, hz)) - minHz) / (maxHz - minHz));

  // 高音参考区背景 (>175 Hz)
  ctx.fillStyle = mintSoft;
  ctx.fillRect(padL, padT, pw, toY(175) - padT);

  // 水平网格
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const gridTicks = maxHz > 320 ? [100, 150, 200, 250, 300] : [100, 150, 200, 250];
  for (const r of gridTicks) {
    const y = toY(r);
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + pw, y);
    ctx.stroke();
    ctx.fillStyle = ink3;
    ctx.fillText(String(r), padL - 6, y);
  }
  ctx.setLineDash([]);

  // 托底线
  if (floorHz >= minHz && floorHz <= maxHz) {
    const yF = toY(floorHz);
    ctx.strokeStyle = mint;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, yF);
    ctx.lineTo(padL + pw, yF);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 音高散点/连线
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = sky;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [t, hz] = pts[i];
    const x = toX(t);
    const y = toY(hz);
    if (i === 0 || (t - pts[i - 1][0]) > 0.35) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // 嘎裂音高亮圆点
  for (const [t, hz, isCreak] of pts) {
    if (isCreak) {
      ctx.fillStyle = coral;
      ctx.beginPath();
      ctx.arc(toX(t), toY(hz), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = ink3;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('0s', padL, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${tMax.toFixed(1)}s`, padL + pw, h - 4);
}

/**
 * 折叠详情区：普通话「衣/啊/乌」元音空间分布对比
 */
export function paintVowelSpace(canvas, ns) {
  if (!canvas || !ns) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(240, Math.round(rect.width || canvas.clientWidth || 300));
  const h = 188;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const paperSoft = css('--paper-3', '#F4F6F9');
  const paperCard = css('--paper-card', '#FFFFFF');
  const ink2 = css('--ink-2', '#526071');
  const ink3 = css('--ink-3', '#8795A6');
  const coral = css('--crayon-coral', '#E27370');
  const mint = css('--crayon-mint', '#6EB5AF');
  const mintSoft = css('--crayon-mint-soft', 'rgba(110, 181, 175, 0.16)');
  const sky = css('--crayon-sky', '#6699CC');
  const lavender = css('--crayon-lavender', '#8A86C8');
  const gridCol = css('--chart-grid', 'rgba(82, 96, 113, 0.18)');

  ctx.fillStyle = paperSoft;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 14);
  ctx.fill();

  // 经典声学元音图惯例：X 轴右->左 为 F2 (2900 -> 700), Y 轴上->下 为 F1 (250 -> 1050)
  const padL = 42;
  const padR = 24;
  const padT = 24;
  const padB = 26;
  const pw = w - padL - padR;
  const ph = h - padT - padB;
  const toX = (f2) => padL + pw * (1 - (Math.max(700, Math.min(2900, f2)) - 700) / (2900 - 700));
  const toY = (f1) => padT + ph * ((Math.max(250, Math.min(1050, f1)) - 250) / (1050 - 250));
  const clampLabelX = (x) => Math.max(padL + 18, Math.min(w - padR - 18, x));

  // 方向导引（动作直觉，不摆双对照大表）
  ctx.fillStyle = ink3;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('← 舌位靠前更亮 (F2)', padL, 7);
  ctx.textAlign = 'right';
  ctx.fillText('↑ 口腔收小 (F1)', w - 10, 7);

  // 轻淡辅助参考轮廓（高共鸣常见轮廓）
  const norms = [
    { key: 'i', label: '衣', f1: 370, f2: 2620 },
    { key: 'a', label: '啊', f1: 880, f2: 1460 },
    { key: 'u', label: '乌', f1: 420, f2: 960 },
  ];

  ctx.fillStyle = mintSoft;
  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(toX(norms[0].f2), toY(norms[0].f1));
  ctx.lineTo(toX(norms[1].f2), toY(norms[1].f1));
  ctx.lineTo(toX(norms[2].f2), toY(norms[2].f1));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  const normPts = norms.map((n) => ({ ...n, x: toX(n.f2), y: toY(n.f1) }));
  const cxTri = (normPts[0].x + normPts[1].x + normPts[2].x) / 3;
  const cyTri = (normPts[0].y + normPts[1].y + normPts[2].y) / 3;
  const occupiedLabels = [];
  const occupiedDots = [];

  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const n of normPts) {
    ctx.fillStyle = ink3;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    occupiedDots.push({ x: n.x, y: n.y });
    const vx = n.x - cxTri;
    const vy = n.y - cyTri;
    const vLen = Math.hypot(vx, vy) || 1;
    const lx = clampLabelX(n.x + (vx / vLen) * 13);
    const ly = Math.max(padT + 8, Math.min(h - 10, n.y + (vy / vLen) * 13));
    ctx.fillText(n.label, lx, ly);
    occupiedLabels.push({ x: lx, y: ly });
  }

  // 实测元音散点云 + 质心点（带 i/a/u/e/o/v 中文单字标签 + 防碰撞偏移）
  const colors = {
    i: mint,
    a: lavender,
    u: sky,
    e: css('--crayon-indigo', '#3E567C'),
    o: coral,
    v: mint,
  };
  const labelMap = { i: '衣', a: '啊', u: '乌', e: '饿', o: '喔', v: '迂' };
  const samples = Array.isArray(ns.vowelSamples) ? ns.vowelSamples : [];
  if (samples.length) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    for (const sp of samples) {
      if (sp && sp.f1 && sp.f2) {
        ctx.fillStyle = colors[sp.vowel] || ink3;
        ctx.beginPath();
        ctx.arc(toX(sp.f2), toY(sp.f1), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  const byV = ns.byVowel || {};
  const measuredNodes = [];
  for (const [k, v] of Object.entries(byV)) {
    if (v && v.f1 && v.f2) {
      measuredNodes.push({
        x: toX(v.f2),
        y: toY(v.f1),
        color: colors[k] || coral,
        label: labelMap[k] || v.label || k,
      });
    }
  }
  if (!measuredNodes.length && ns.f1 && ns.f2) {
    measuredNodes.push({
      x: toX(ns.f2),
      y: toY(ns.f1),
      color: coral,
      label: '均值',
    });
  }

  for (const node of measuredNodes) {
    occupiedDots.push({ x: node.x, y: node.y });
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = paperCard;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  const candidateOffsets = [
    [0, 15], [0, -15], [16, 0], [-16, 0],
    [13, 13], [-13, 13], [13, -13], [-13, -13],
    [0, 24], [0, -24],
  ];
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const node of measuredNodes) {
    let best = { x: clampLabelX(node.x), y: Math.min(h - 10, node.y + 15), score: -1 };
    for (const [dx, dy] of candidateOffsets) {
      const cx = clampLabelX(node.x + dx);
      const cy = Math.max(padT + 8, Math.min(h - 10, node.y + dy));
      let minLbl = 999;
      for (const p of occupiedLabels) {
        minLbl = Math.min(minLbl, Math.hypot(cx - p.x, cy - p.y));
      }
      let minDot = 999;
      for (const d of occupiedDots) {
        if (Math.abs(d.x - node.x) < 0.5 && Math.abs(d.y - node.y) < 0.5) continue;
        minDot = Math.min(minDot, Math.hypot(cx - d.x, cy - d.y));
      }
      const score = Math.min(minLbl, minDot * 1.4);
      if (minLbl >= 24 && minDot >= 16) {
        best = { x: cx, y: cy, score };
        break;
      }
      if (score > best.score) {
        best = { x: cx, y: cy, score };
      }
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = paperSoft;
    ctx.strokeText(node.label, best.x, best.y);
    ctx.fillStyle = ink2;
    ctx.fillText(node.label, best.x, best.y);
    occupiedLabels.push({ x: best.x, y: best.y });
  }

  const drawn = measuredNodes.length;
  if (!drawn) {
    ctx.fillStyle = ink3;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText('未检出清晰孤立元音（试试「做测试 → 衣音/啊音」）', w / 2, h - 8);
  }
}

/**
 * 构建 AI 深度问诊提示词 / 简要复盘文案
 */
export function buildAiPrompt(take, ns, mode = 'rich') {
  if (!take || !ns) return '';
  if (mode === 'rich') {
    return renderConsultationMarkdown(take);
  }
  const f0Str = ns.medianF0 ? `${Math.round(ns.medianF0)} Hz (${pitchName(ns.medianF0)})` : '未测出';
  const h12 = ns.h1h2 != null ? `${fmtSigned(ns.h1h2)} dB` : '未测出';
  const h15 = ns.h1h5Db != null ? `${fmtSigned(ns.h1h5Db)} dB` : '—';
  const tilt = ns.spectralTiltDbOct != null ? `${fmtSigned(ns.spectralTiltDbOct)} dB/oct` : '—';
  const dfVal = ns.deltaF ?? ns.effDeltaF;
  const df = dfVal != null ? `${Math.round(dfVal)} Hz` : '—';
  const f123 = [ns.f1, ns.f2, ns.f3].map((v) => (v != null ? Math.round(v) : '—')).join(' / ');
  return [
    '我在用「电波日记 v2.0」做性别肯定嗓音练习，请用温和非恐吓、基于体感的方式帮我复盘这次数据：',
    `- 练习内容：${take.setName || '自由表达'}（有声时长 ${ns.voicedSec != null ? ns.voicedSec.toFixed(1) : '—'} 秒）`,
    `- 音高基准：中位音高 ${f0Str}，音高起伏 ${ns.spanSt != null ? ns.spanSt.toFixed(1) : '—'} st，托底达成率 ${ns.floorSafeRatio ?? '—'}%`,
    `- 谐波与音色象限：${ns.quadrant?.summaryLabel || '—'}`,
    `- 声门轻重 (H1-H2)：${h12}（${ns.spectralStatus || '—'}）`,
    `- 共振峰 F1/F2/F3 与间距：${f123} Hz · ΔF ${df}；H1-H5 ${h15}，频谱倾斜 ${tilt}`,
    ns.bottleneckHint ? `- 综合声学排查：${ns.bottleneckHint}` : '',
    ns.toneSummary ? `- 声调提醒：${ns.toneSummary}` : '',
    take.stamp ? `- 我的主观体感：心情「${take.stamp.mood || ''}」喉部「${take.stamp.throat || ''}」${take.stamp.note ? ' 备注：' + take.stamp.note : ''}` : '',
    '请给我 1 个当前做得最好的地方 + 1 个最温和不费力的微调动作。',
  ].filter(Boolean).join('\n');
}

/**
 * 导出音频文件（WAV / 原生桥接 / Web Share / 浏览器下载）
 */
export async function exportTakeAudioWav(take) {
  if (!take || !take.blob) {
    return { ok: false, message: '这条记录没有留存音频波形' };
  }
  const d = new Date(take.ts || Date.now());
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const ext = take.blob.type && take.blob.type.includes('webm') ? 'webm' : 'wav';
  const fileName = `电波日记_${stamp}.${ext}`;
  const mime = take.blob.type || (ext === 'webm' ? 'audio/webm' : 'audio/wav');
  const f0Str = take.stats?.medianF0 ? `${Math.round(take.stats.medianF0)}Hz` : '录音';

  // 1. 原生 Android 桥接（优先调用 saveFile 写入公共下载/QingLai 目录）
  if (typeof window !== 'undefined' && window.DshFile) {
    try {
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = String(reader.result || '');
          const idx = res.indexOf(',');
          resolve(idx >= 0 ? res.slice(idx + 1) : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(take.blob);
      });

      let resPath = null;
      if (typeof window.DshFile.saveFile === 'function') {
        resPath = window.DshFile.saveFile(fileName, b64, mime);
      } else if (typeof window.DshFile.save === 'function') {
        resPath = window.DshFile.save(fileName, mime, b64);
      } else if (typeof window.DshFile.saveBase64 === 'function') {
        resPath = window.DshFile.saveBase64(fileName, b64);
      }

      if (resPath && !String(resPath).startsWith('ERR:')) {
        return { ok: true, method: 'android', fileName, path: String(resPath) };
      }
      if (resPath && String(resPath).startsWith('ERR:')) {
        return { ok: false, message: `保存失败：${String(resPath).slice(4)}` };
      }
    } catch (err) {
      return { ok: false, message: `音频导出异常：${err?.message || '请重试'}` };
    }
  }

  // 2. 外部浏览器环境：尝试 Web Share API
  try {
    const file = new File([take.blob], fileName, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `电波日记录音 (${f0Str})`,
        text: `「电波日记」练习录音 (${f0Str})`,
        files: [file],
      });
      return { ok: true, method: 'share', fileName };
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return { ok: false, cancelled: true };
  }

  // 3. 浏览器普通下载兜底
  const url = URL.createObjectURL(take.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { ok: true, method: 'download', fileName };
}
