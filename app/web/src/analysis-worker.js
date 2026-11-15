/* ===========================================================
   analysis-worker.js — 把离线分析挪出主线程

   只做一件事：收到参数 → 调 summarize() → 把结果发回去。
   一个字的算法都没有，就是为了保证**数值和主线程版本完全一致**：
   同一个 gating.js，同一份代码，只是换了执行的线程。

   注意：这里不能 import main.js，也不能碰 DOM。
   =========================================================== */

import { summarize } from './metrics/gating.js';

self.onmessage = (e) => {
  const d = e.data || {};
  const { id } = d;
  try {
    const out = summarize(d.frames, d.pcm, d.sampleRate, d.mode, d.floorF0);
    // 结果里若混进不可结构化克隆的东西，postMessage 会抛 DataCloneError，
    // 主线程收到错误后会回退到同步计算 —— 不静默失败。
    self.postMessage({ id, ok: true, out });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
