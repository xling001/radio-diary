/* ===========================================================
   history/charts.js — 练习热力图与音高 / H1-H2 双轨趋势图
   =========================================================== */

const css = (k, fb) => (typeof window !== 'undefined' && window.cssVar ? window.cssVar(k, fb) : fb);

function localDateKey(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 绘制近 12 周（84 天）每日练习热力图
 */
export function paintHeatmap(canvas, takes = []) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(260, Math.round(rect.width || canvas.clientWidth || 320));
  const h = 116;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const paperSoft = css('--paper-3', '#F4F6F9');
  const groove = css('--paper-groove', '#E8EDF4');
  const ink3 = css('--ink-3', '#8795A6');
  const mintSoft = css('--crayon-mint-soft', 'rgba(110, 181, 175, 0.25)');
  const mint = css('--crayon-mint', '#6EB5AF');
  const coral = css('--crayon-coral', '#E27370');

  const countByDay = new Map();
  for (const t of takes) {
    const k = localDateKey(t.ts);
    countByDay.set(k, (countByDay.get(k) || 0) + 1);
  }

  const cols = 12;
  const rows = 7;
  const totalDays = cols * rows;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (totalDays - 1) * 86400000);

  const padL = 10;
  const padR = 10;
  const padT = 18;
  const padB = 10;
  const gridW = w - padL - padR;
  const gridH = h - padT - padB;
  const cellW = gridW / cols;
  const cellH = gridH / rows;
  const size = Math.min(cellW - 4, cellH - 3, 12);

  ctx.fillStyle = paperSoft;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 14);
  ctx.fill();

  ctx.fillStyle = ink3;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('近 12 周练习脚印', padL, 4);

  ctx.textAlign = 'right';
  ctx.fillText('今天', w - padR, 4);

  for (let i = 0; i < totalDays; i++) {
    const day = new Date(start.getTime() + i * 86400000);
    const key = localDateKey(day.getTime());
    const cnt = countByDay.get(key) || 0;
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = padL + col * cellW + (cellW - size) / 2;
    const y = padT + row * cellH + (cellH - size) / 2;

    if (cnt === 0) ctx.fillStyle = groove;
    else if (cnt === 1) ctx.fillStyle = mintSoft;
    else if (cnt <= 3) ctx.fillStyle = mint;
    else ctx.fillStyle = coral;

    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 3.5);
    ctx.fill();
  }
}

/**
 * 绘制时间趋势折线图：支持 'pitch' (中位 F0) 或 'weight' (H1-H2)
 */
export function paintTrendChart(canvas, takes = [], metric = 'pitch', floorHz = 160) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(260, Math.round(rect.width || canvas.clientWidth || 320));
  const h = 152;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const paperSoft = css('--paper-3', '#F7F4EF');
  const paperCard = css('--paper-card', '#FFFEFC');
  const ink3 = css('--ink-3', '#6B6975');
  const gridCol = css('--chart-grid', 'rgba(52, 42, 34, 0.14)');
  const mintSoft = css('--crayon-mint-soft', 'rgba(110, 181, 175, 0.16)');
  const mint = css('--crayon-mint', '#6EB5AF');
  const sky = css('--crayon-sky', '#5B92C9');
  const amber = css('--crayon-amber', '#E8A852');
  const coral = css('--crayon-coral', '#E27370');

  ctx.fillStyle = paperSoft;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 14);
  ctx.fill();

  // 按时间正序取最近 24 条有效记录
  const points = [...takes]
    .sort((a, b) => a.ts - b.ts)
    .map((t) => {
      const f0 = t.stats?.medianF0;
      const h12 = t.stats?.spectral?.h1h2Db ?? t.stats?.spectralVoice?.h1h2Db;
      return {
        ts: t.ts,
        val: metric === 'weight' ? h12 : f0,
      };
    })
    .filter((p) => p.val != null && Number.isFinite(p.val))
    .slice(-24);

  if (points.length < 2) {
    ctx.fillStyle = ink3;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      metric === 'weight' ? '积累 2 条以上有效 H1-H2 记录后呈现放松趋势' : '积累 2 条以上有效音高记录后呈现变化趋势',
      w / 2,
      h / 2
    );
    return;
  }

  const padL = 38;
  const padR = 14;
  const padT = 20;
  const padB = 20;
  const pw = w - padL - padR;
  const ph = h - padT - padB;

  const vals = points.map((p) => p.val);
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);
  const minVal = metric === 'weight'
    ? Math.min(-6, Math.floor(dataMin - 1))
    : Math.min(90, Math.floor((dataMin - 10) / 10) * 10);
  const maxVal = metric === 'weight'
    ? Math.max(16, Math.ceil(dataMax + 2))
    : Math.max(260, Math.ceil((dataMax + 15) / 10) * 10);
  const clampV = (v) => Math.max(minVal, Math.min(maxVal, v));
  const toY = (v) => padT + ph * (1 - (clampV(v) - minVal) / (maxVal - minVal));
  const toX = (idx) => padL + (idx / (points.length - 1)) * pw;

  // 目标舒适带
  ctx.fillStyle = mintSoft;
  if (metric === 'weight') {
    const yHi = toY(5.0);
    const yLo = toY(1.5);
    ctx.fillRect(padL, yHi, pw, yLo - yHi);
  } else {
    const y175 = toY(175);
    if (y175 > padT) ctx.fillRect(padL, padT, pw, y175 - padT);
  }

  // 参照刻度线
  const baseRefs = metric === 'weight' ? [-2, 1.5, 5, 10, 14] : [100, 145, 175, 220];
  const refs = baseRefs.filter((r) => r >= minVal && r <= maxVal);
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const r of refs) {
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

  if (metric === 'pitch' && floorHz >= minVal && floorHz <= maxVal) {
    const yF = toY(floorHz);
    ctx.strokeStyle = mint;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, yF);
    ctx.lineTo(padL + pw, yF);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 平滑折线
  ctx.strokeStyle = metric === 'weight' ? amber : sky;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, idx) => {
    const x = toX(idx);
    const y = toY(p.val);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // 数据节点
  points.forEach((p, idx) => {
    const x = toX(idx);
    const y = toY(p.val);
    let dotCol = sky;
    if (metric === 'weight') {
      dotCol = (p.val > 1.5 && p.val <= 5.0) ? mint : (p.val <= -0.4 ? coral : amber);
    } else {
      dotCol = p.val >= floorHz ? mint : coral;
    }
    ctx.fillStyle = dotCol;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = paperCard;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  ctx.fillStyle = ink3;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`更早 (${points.length}条)`, padL, h - 4);
  ctx.textAlign = 'right';
  ctx.fillText(metric === 'weight' ? '舒展目标 +1.5~+5 dB' : '最近一次', padL + pw, h - 4);
}
