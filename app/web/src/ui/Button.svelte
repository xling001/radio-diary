<script>
  let {
    variant = 'primary', // 'primary' | 'soft' | 'ghost' | 'pill' | 'danger'
    size = 'md',        // 'sm' | 'md' | 'lg' | 'icon'
    type = 'button',
    disabled = false,
    block = false,
    onclick = null,
    children,
    ...rest
  } = $props();
</script>

<button
  {type}
  class="dsh-btn btn-{variant} size-{size} {block ? 'block' : ''}"
  {disabled}
  onclick={onclick}
  {...rest}
>
  {@render children?.()}
</button>

<style>
  .dsh-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-sizing: border-box;
    border: none;
    font-family: var(--font-ui, system-ui, sans-serif);
    font-weight: 500;
    line-height: 1.2;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.12s ease, opacity 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  }

  /* 48px 触控防御伪类（即便视觉较小，触控热区也始终 ≥ 48px） */
  .dsh-btn::after {
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

  .dsh-btn:active:not(:disabled) {
    transform: scale(0.96);
  }

  .dsh-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }

  /* 尺寸 */
  .size-md {
    height: 44px;
    padding: 0 18px;
    font-size: var(--fs-14, 14px);
    border-radius: var(--radius-sm, 12px);
  }
  .size-sm {
    height: 36px;
    padding: 0 12px;
    font-size: var(--fs-12, 12px);
    border-radius: var(--radius-sm, 12px);
  }
  .size-lg {
    height: 48px;
    padding: 0 24px;
    font-size: var(--fs-16, 16px);
    border-radius: var(--radius-md, 14px);
  }
  .size-icon {
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 999px;
  }

  .block {
    display: flex;
    width: 100%;
  }

  /* 变体风格 */
  .btn-primary {
    background: linear-gradient(180deg, var(--rose-fill-hi) 0%, var(--rose-fill) 100%);
    color: var(--rose-on);
    box-shadow: var(--shadow);
  }
  .btn-primary:active:not(:disabled) {
    background: var(--rose-fill);
  }

  .btn-soft {
    background: var(--paper-3);
    color: var(--ink-1);
    border: 1px solid var(--border-soft);
  }
  .btn-soft:active:not(:disabled) {
    background: var(--paper-groove);
  }

  .btn-ghost {
    background: transparent;
    color: var(--ink-2);
    border: 1px solid var(--border-soft);
  }
  .btn-ghost:active:not(:disabled) {
    background: var(--paper-3);
  }

  .btn-pill {
    background: var(--rose-soft);
    color: var(--rose-deep);
    border-radius: 999px;
  }

  .btn-danger {
    background: rgba(186, 73, 73, 0.1);
    color: var(--danger-ink);
    border: 1px solid rgba(186, 73, 73, 0.25);
  }
  .btn-danger:active:not(:disabled) {
    background: rgba(186, 73, 73, 0.18);
  }
</style>
