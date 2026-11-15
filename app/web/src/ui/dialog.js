/**
 * ui/dialog.js — 应用内对话框（替代原生 alert / confirm）
 *
 * 为什么要替换：原生弹窗是系统灰白方框，和全站纸感完全断开；
 * 而且按钮固定是「确定/取消」，与我们全站用词（「删掉」「先不算」）不一致。
 *
 * 规则：
 * - 复用现有 token，不引入新颜色
 * - 危险动作的按钮用 --rose-deep，不用刺眼的红（产品底线：不恐吓）
 * - 点遮罩 / 按 Esc = 取消
 * - 无依赖、纯 DOM；不碰任何算法或数据
 */

const ROOT_ID = 'dsh-dialog-root';

function ensureRoot() {
  let root = document.getElementById(ROOT_ID);
  if (root) return root;
  root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
    'width:100%', 'height:100%', 'z-index:9999', 'display:none',
    'align-items:center', 'justify-content:center', 'padding:20px',
    'box-sizing:border-box', 'overflow:hidden',
    'background:rgba(61,55,51,.32)', 'backdrop-filter:blur(3px)',
  ].join(';');
  document.body.appendChild(root);
  return root;
}

function buildCard({ title, text, okText, cancelText, danger }) {
  const card = document.createElement('div');
  card.style.cssText = [
    'width:100%', 'max-width:340px', 'box-sizing:border-box',
    'background:var(--paper-2)', 'color:var(--ink)',
    'border:var(--edge)', 'border-radius:var(--radius-lg)',
    'box-shadow:var(--shadow-lift)', 'padding:20px 20px 14px',
    'font-family:var(--font-ui)', 'line-height:1.65',
    'word-break:break-all', 'overflow-wrap:anywhere',
  ].join(';');

  if (title) {
    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'font-size:var(--fs-16);font-weight:600;margin-bottom:8px;word-break:break-all;overflow-wrap:anywhere;';
    card.appendChild(h);
  }

  const p = document.createElement('div');
  p.textContent = text || '';
  p.style.cssText = 'font-size:var(--fs-14);color:var(--ink-2);white-space:pre-wrap;word-break:break-all;overflow-wrap:anywhere;margin-bottom:16px;max-height:60vh;overflow-y:auto;';
  card.appendChild(p);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

  if (cancelText) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = cancelText;
    cancel.style.cssText = [
      'flex:1', 'min-height:40px', 'border-radius:999px', 'border:var(--edge)',
      'background:transparent', 'color:var(--ink-2)',
      'font-family:var(--font-ui)', 'font-size:var(--fs-14)', 'cursor:pointer',
    ].join(';');
    cancel.dataset.role = 'cancel';
    row.appendChild(cancel);
  }

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.textContent = okText || '好';
  ok.style.cssText = [
    'flex:1', 'min-height:40px', 'border-radius:999px', 'border:none',
    'background:' + (danger ? 'var(--rose-deep)' : 'var(--sage)'),
    'color:' + (danger ? '#FDFBF7' : 'var(--sage-on)'),
    'font-family:var(--font-ui)', 'font-size:var(--fs-14)',
    'font-weight:600', 'cursor:pointer',
  ].join(';');
  ok.dataset.role = 'ok';
  row.appendChild(ok);

  card.appendChild(row);
  return card;
}

/**
 * 单按钮提示。用法：showAlert('提示文字') 或 showAlert('标题', '正文')
 * 兼容原 alert 的单字符串调用，方便批量替换。
 */
export function showAlert(a, b, opts = {}) {
  const hasTitle = typeof b === 'string' && b.length > 0;
  const title = hasTitle ? a : (opts.title || '');
  const text = hasTitle ? b : a;
  return new Promise((resolve) => {
    const root = ensureRoot();
    root.innerHTML = '';
    const card = buildCard({
      title, text,
      okText: opts.okText || '好',
      cancelText: null,
      danger: !!opts.danger,
    });
    root.appendChild(card);
    root.style.display = 'flex';

    let done = false;
    let onRootClick = null;
    const close = () => {
      if (done) return;
      done = true;
      root.style.display = 'none';
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      if (onRootClick) root.removeEventListener('click', onRootClick);
      resolve(true);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    onRootClick = (e) => { if (e.target === root) close(); };
    document.addEventListener('keydown', onKey);

    card.querySelector('[data-role="ok"]').addEventListener('click', close, { once: true });
    root.addEventListener('click', onRootClick);
  });
}

/**
 * 双按钮确认，返回 Promise<boolean>。
 * 用法：if (await askConfirm('删掉这 3 条？这个不能撤销。', { okText: '删掉', danger: true })) { … }
 */
export function askConfirm(text, opts = {}) {
  return new Promise((resolve) => {
    const root = ensureRoot();
    root.innerHTML = '';
    const card = buildCard({
      title: opts.title || '',
      text,
      okText: opts.okText || '好',
      cancelText: opts.cancelText || '再想想',
      danger: !!opts.danger,
    });
    root.appendChild(card);
    root.style.display = 'flex';

    let done = false;
    let onRootClick = null;
    const finish = (val) => {
      if (done) return;
      done = true;
      root.style.display = 'none';
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      if (onRootClick) root.removeEventListener('click', onRootClick);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };
    onRootClick = (e) => { if (e.target === root) finish(false); };
    document.addEventListener('keydown', onKey);

    card.querySelector('[data-role="ok"]').addEventListener('click', () => finish(true), { once: true });
    card.querySelector('[data-role="cancel"]').addEventListener('click', () => finish(false), { once: true });
    root.addEventListener('click', onRootClick);
  });
}

export const alertDlg = showAlert;

export function confirmDlg(title, text, okText = '确定', cancelText = '先留着', danger = false) {
  return askConfirm(text, { title, okText, cancelText, danger });
}
