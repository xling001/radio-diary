/* ===========================================================
   ui/wakeLock.js — 按场景精准屏幕常亮服务
   - Android 壳：调用 DshFile.setKeepScreenOn (FLAG_KEEP_SCREEN_ON)，零新增权限
   - 浏览器 / PWA：调用 Screen Wake Lock API (navigator.wakeLock)
   - 使用引用计数 (activeReasons)，多场景叠加互不误关
   =========================================================== */

const activeReasons = new Set();
let sentinel = null;
let pendingRequest = null;

function setAndroidKeepScreenOn(enabled) {
  if (typeof window === 'undefined') return;
  try {
    if (window.DshFile && typeof window.DshFile.setKeepScreenOn === 'function') {
      window.DshFile.setKeepScreenOn(Boolean(enabled));
    }
  } catch {
    // 忽略旧版原生桥不可用情况
  }
}

async function requestWebWakeLock() {
  if (sentinel || pendingRequest) return;
  if (typeof navigator === 'undefined' || !navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') {
    return;
  }
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return;
  }
  pendingRequest = navigator.wakeLock.request('screen');
  try {
    const acquired = await pendingRequest;
    if (!acquired) return;
    if (activeReasons.size === 0) {
      acquired.release().catch(() => {});
      return;
    }
    sentinel = acquired;
    acquired.addEventListener('release', () => {
      if (sentinel === acquired) {
        sentinel = null;
      }
    });
  } catch {
    // 低电量模式或环境不支持时静默降级
  } finally {
    pendingRequest = null;
  }
}

function releaseWebWakeLock() {
  if (!sentinel) return;
  const current = sentinel;
  sentinel = null;
  try {
    current.release().catch(() => {});
  } catch {
    // 忽略已释放异常
  }
}

function syncWakeState() {
  const shouldKeepOn = activeReasons.size > 0;
  setAndroidKeepScreenOn(shouldKeepOn);
  if (shouldKeepOn) {
    requestWebWakeLock();
  } else {
    releaseWebWakeLock();
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeReasons.size > 0) {
      syncWakeState();
    }
  });
}

/**
 * 为指定活跃场景申请保持屏幕常亮
 * @param {string} reason e.g. 'record' | 'autoscroll' | 'playback'
 */
export function acquireScreenWake(reason) {
  if (!reason) return;
  activeReasons.add(reason);
  syncWakeState();
}

/**
 * 释放指定场景的屏幕常亮申请（当全部场景释放后恢复系统默认息屏）
 * @param {string} reason e.g. 'record' | 'autoscroll' | 'playback'
 */
export function releaseScreenWake(reason) {
  if (!reason) return;
  activeReasons.delete(reason);
  syncWakeState();
}
