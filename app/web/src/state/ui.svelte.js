/* ===========================================================
   state/ui.svelte.js — 全局 UI 与路由状态管理 (Svelte 5 Runes)

   核心职责：
   1. 单一路由主人：集中管理 Hash 路由 (#/view 或 #/view/sub)
   2. 物理返回栈治理：弹层、二级页面、Tab 间返回、栈底双击退出
   3. 滚动位置记忆：离开时记录位置，返回时丝滑恢复
   =========================================================== */

class UIState {
  currentView = $state('record');
  subRoute = $state(null);
  prevView = $state('record');
  layers = $state([]);
  historyStack = $state(['record']);

  #scrollMemory = new Map();
  #lastBackPressTime = 0;
  #listeners = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => this.#onHashChange());
      window.addEventListener('popstate', (e) => this.#onPopState(e));
      this.#initFromLocation();
    }
  }

  #initFromLocation() {
    const parsed = this.parseHash(window.location.hash);
    this.currentView = parsed.view;
    this.subRoute = parsed.sub;
  }

  parseHash(hash = '') {
    const clean = hash.replace(/^#?\/?/, '').trim();
    if (!clean) return { view: 'record', sub: null, raw: '#/record' };
    const parts = clean.split('/').filter(Boolean);
    let view = parts[0] || 'record';
    if (view === 'tutorial') view = 'mindset';
    if (view === 'rec') view = 'record';
    const sub = parts.length > 1 ? parts.slice(1).join('/') : null;
    return { view, sub, raw: `#/${clean}` };
  }

  #onHashChange() {
    const parsed = this.parseHash(window.location.hash);
    const oldView = this.currentView;
    const oldSub = this.subRoute;
    const oldKey = oldSub ? `${oldView}/${oldSub}` : oldView;

    // 记忆当前离开视图的滚动位置
    this.#scrollMemory.set(oldKey, window.scrollY || 0);

    if (oldView !== parsed.view) {
      this.prevView = oldView;
      this.historyStack.push(parsed.view);
      if (this.historyStack.length > 20) this.historyStack.shift();
    }

    this.currentView = parsed.view;
    this.subRoute = parsed.sub;

    // 通知外部监听者（如老 main.js 中的视图容器切换）
    this.#notify(parsed, { oldView, oldSub });

    // 恢复新视图滚动位置
    const newKey = parsed.sub ? `${parsed.view}/${parsed.sub}` : parsed.view;
    const savedY = this.#scrollMemory.get(newKey) || 0;
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedY, behavior: 'instant' });
    });
  }

  #onPopState(e) {
    if (this.layers.length > 0 && (!e.state || !e.state.overlay)) {
      this.layers.pop();
    }
  }

  #notify(route, meta) {
    this.#listeners.forEach((fn) => {
      try { fn(route, meta); } catch (err) { console.error('UI listener err:', err); }
    });
  }

  subscribe(fn) {
    this.#listeners.add(fn);
    // 立即执行一次初始状态
    fn({ view: this.currentView, sub: this.subRoute }, { oldView: null, oldSub: null });
    return () => this.#listeners.delete(fn);
  }

  /** 导航跳转至指定页面 */
  navigate(path, { replace = false } = {}) {
    const clean = path.replace(/^#?\/?/, '');
    const targetHash = `#/${clean}`;
    if (window.location.hash === targetHash) {
      // 相同 hash 直接触发一次刷新处理
      this.#onHashChange();
      return;
    }
    if (replace) {
      const url = `${window.location.pathname}${window.location.search}${targetHash}`;
      window.location.replace(url);
    } else {
      window.location.hash = targetHash;
    }
  }

  /** 压入弹层遮罩 */
  pushOverlay(name) {
    this.layers.push(name);
    window.history.pushState({ overlay: name }, '', window.location.hash);
  }

  /** 弹出弹层 */
  popOverlay() {
    if (this.layers.length > 0) {
      window.history.back();
    }
  }

  /** 获取当前视图滚动高度 */
  getSavedScroll(key) {
    return this.#scrollMemory.get(key) || 0;
  }

  /**
   * 全局统一返回键拦截器
   * @returns {boolean} true: 已被前端消费拦截; false: 允许退出 App
   */
  handleBack() {
    // 1. 若有活动弹层，优先关闭顶层弹层
    if (this.layers.length > 0) {
      this.popOverlay();
      return true;
    }

    // 2. 分析页详情：无论是带有 subRoute 还是主视图，返回均回退到前一个视图 (优先 hand-off 回 history)
    if (this.currentView === 'analysis') {
      const target = (this.prevView && this.prevView !== 'analysis') ? this.prevView : 'history';
      this.navigate(target);
      return true;
    }

    // 3. 心法教程 / 手账二级页：若处于二级子路由，退回主目录
    if ((this.currentView === 'mindset' || this.currentView === 'history') && this.subRoute) {
      this.navigate(this.currentView);
      return true;
    }

    // 4. 其他二级视图（settings, library, mindset, history 等）：返回上一个前置视图，或回主页 record
    if (this.currentView !== 'record') {
      const target = (this.prevView && this.prevView !== this.currentView) ? this.prevView : 'record';
      this.navigate(target);
      return true;
    }

    // 5. 处于主页栈底：双击退出保护
    const now = Date.now();
    if (now - this.#lastBackPressTime < 2000) {
      return false; // 放行退出
    }
    this.#lastBackPressTime = now;
    if (typeof window.showNotice === 'function') {
      window.showNotice('再按一次退出电波日记');
    }
    return true;
  }
}

export const ui = new UIState();
