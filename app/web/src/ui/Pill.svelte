<script>
  let {
    active = false,
    variant = 'rose', // 'rose' | 'sage' | 'apricot' | 'slate'
    onclick = null,
    children,
    ...rest
  } = $props();
</script>

<button
  type="button"
  class="dsh-pill pill-{variant} {active ? 'active' : ''}"
  onclick={onclick}
  {...rest}
>
  {@render children?.()}
</button>

<style>
  .dsh-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--border-soft);
    background: var(--paper-card);
    color: var(--ink-2);
    font-family: var(--font-ui, system-ui, sans-serif);
    font-size: var(--fs-12, 12px);
    font-weight: 500;
    line-height: 1.2;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: all 0.15s ease;
    white-space: nowrap !important;
    flex: 0 0 auto;
  }

  /* 48px 触控防御伪类 */
  .dsh-pill::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 48px;
    min-height: 48px;
    width: 100%;
    height: 100%;
  }

  .dsh-pill:active {
    transform: scale(0.95);
  }

  /* 激活态 */
  .pill-rose.active {
    background: var(--rose-soft);
    border-color: var(--rose);
    color: var(--rose-chip-ink);
    font-weight: 600;
  }

  .pill-sage.active {
    background: var(--sage-soft);
    border-color: var(--sage);
    color: var(--sage-chip-ink);
    font-weight: 600;
  }

  .pill-apricot.active {
    background: var(--apricot-soft);
    border-color: var(--apricot);
    color: var(--apricot-chip-ink);
    font-weight: 600;
  }

  .pill-slate.active {
    background: var(--slate-soft);
    border-color: var(--slate);
    color: var(--slate-chip-ink);
    font-weight: 600;
  }
</style>
