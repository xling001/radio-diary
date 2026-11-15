/* ===========================================================
   record/charts.js — 实时蜡笔音高带与安全托底参考线画布
   =========================================================== */

const css = (k, fb) => (typeof window !== 'undefined' && window.cssVar ? window.cssVar(k, fb) : fb);

/**
 * 绘制实时音高蜡笔带（过去 ~8 秒滚动窗口）
 * @param {HTMLCanvasElement} canvas
 * @param {Array} frames
 * @param {number} floorHz - 用户安全托底线 (150~165 Hz)
 * @param {object} [opts]
 * @param {boolean} [opts.isUnvoiced=false] - 当前为纯吹气测试（如清擦音 [s]）
 */
export function paintLivePitch(canvas, frames = [], floorHz = 160, opts = {}) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(240, Math.round(rect.width || canvas.clientWidth || 320));
  const h = Math.max(112, Math.round(rect.height || canvas.clientHeight || 138));
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
  const amberSoft = css('--crayon-amber-soft', 'rgba(232, 168, 82, 0.14)');
  const mint = css('--crayon-mint', '#6EB5AF');
  const sky = css('--crayon-sky', '#6699CC');
  const coral = css('--crayon-coral', '#E27370');
  const gridCol = css('--chart-grid', 'rgba(82, 96, 113, 0.14)');

  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 14;
  const pw = w - padL - padR;
  const ph = h - padT - padB;

  const minHz = 95;
  const maxHz = 300;
  const toY = (hz) => {
    const clamped = Math.max(minHz, Math.min(maxHz, hz));
    return padT + ph * (1 - (clamped - minHz) / (maxHz - minHz));
  };

  // 背景圆角块
  ctx.fillStyle = paperSoft;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 14);
  ctx.fill();

  if (opts.isUnvoiced) {
    ctx.fillStyle = ink3;
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillText('清擦音 [s] 为纯吹气、声带不振动，无音高曲线属正常', cx, cy - 10);
    ctx.fillText('请专注前唇齿细腻气流体感，结束后将参考高频重心', cx, cy + 12);
    return;
  }

  // 高音参考区 (>175 Hz) 与中性过渡带 (145~175 Hz)
  const yTop = padT;
  const y175 = toY(175);
  const y145 = toY(145);

  ctx.fillStyle = mintSoft;
  ctx.fillRect(padL, yTop, pw, y175 - yTop);

  ctx.fillStyle = amberSoft;
  ctx.fillRect(padL, y175, pw, y145 - y175);

  // 水平参照线与左侧刻度（用极细实线，避免与虚线托底线在 150/155 Hz 附近重影打架）
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.setLineDash([]);
  for (const refHz of [100, 150, 200, 250]) {
    const y = toY(refHz);
    if (!floorHz || Math.abs(refHz - floorHz) > 12) {
      ctx.strokeStyle = gridCol;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + pw, y);
      ctx.stroke();
    }
    ctx.fillStyle = ink3;
    ctx.fillText(String(refHz), padL - 6, y);
  }

  // 专属安全托底线（标签放到右侧内部，避免与左侧刻度或中间提示相撞）
  if (floorHz && floorHz >= minHz && floorHz <= maxHz) {
    const yFloor = toY(floorHz);
    ctx.strokeStyle = mint;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, yFloor);
    ctx.lineTo(padL + pw, yFloor);
    ctx.stroke();
    ctx.setLineDash([]);

    const tagText = `托底 ${floorHz}Hz`;
    ctx.font = '600 10px system-ui, sans-serif';
    const tagW = Math.ceil(ctx.measureText(tagText).width) + 14;
    const tagH = 18;
    const tagX = padL + pw - tagW - 6;
    const tagY = yFloor - tagH - 4 >= padT + 2 ? yFloor - tagH - 4 : yFloor + 4;
    ctx.fillStyle = css('--seal-tag-bg', 'rgba(255, 254, 252, 0.88)');
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 4);
    ctx.fill();
    ctx.fillStyle = mint;
    ctx.fillRect(tagX + 2, tagY + 3, 2.5, tagH - 6);
    ctx.fillStyle = css('--crayon-mint-ink', mint);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, tagX + tagW - 6, tagY + tagH / 2 + 0.5);
  }

  // 绘制最近 8 秒滚动轨迹
  if (!frames.length) {
    const emptyMsg = '点击麦克风，实时观察音高曲线';
    ctx.font = '12px system-ui, sans-serif';
    const mw = Math.ceil(ctx.measureText(emptyMsg).width) + 20;
    const cx = padL + pw / 2;
    const cy = padT + ph / 2;
    ctx.fillStyle = paperSoft;
    ctx.beginPath();
    ctx.roundRect(cx - mw / 2, cy - 11, mw, 22, 11);
    ctx.fill();
    ctx.fillStyle = ink3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emptyMsg, cx, cy);
    return;
  }

  const latestT = frames[frames.length - 1].t || 0;
  const winSec = 8.0;
  const startT = Math.max(0, latestT - winSec);
  const visible = frames.filter((f) => f.t >= startT);

  const toX = (t) => padL + pw * ((t - startT) / winSec);

  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let penDown = false;
  let lastPt = null;
  for (let i = 0; i < visible.length; i++) {
    const f = visible[i];
    if (!f.hz) {
      if (penDown) { ctx.stroke(); penDown = false; }
      continue;
    }
    const x = toX(f.t);
    const y = toY(f.hz);
    const segColor = f.hz >= floorHz ? sky : coral;
    if (!penDown) {
      ctx.beginPath();
      ctx.strokeStyle = segColor;
      ctx.moveTo(x, y);
      penDown = true;
    } else {
      ctx.lineTo(x, y);
      if (i % 4 === 0 || (i + 1 < visible.length && !visible[i + 1].hz)) {
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = segColor;
        ctx.moveTo(x, y);
      }
    }
    lastPt = { x, y, hz: f.hz };
  }
  if (penDown) ctx.stroke();

  if (lastPt) {
    ctx.fillStyle = lastPt.hz >= floorHz ? mint : coral;
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
}
