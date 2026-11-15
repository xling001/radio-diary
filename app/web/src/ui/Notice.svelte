<script>
  let {
    variant = 'info', // 'info' | 'success' | 'warning' | 'danger'
    text = '',
    children,
    ...rest
  } = $props();
</script>

<div class="dsh-notice notice-{variant}" role="status" {...rest}>
  {#if text}
    <span>{text}</span>
  {/if}
  {@render children?.()}
</div>

<style>
  .dsh-notice {
    padding: 9px 14px;
    border-radius: var(--radius-sm, 12px);
    font-size: var(--fs-12, 12px);
    line-height: 1.5;
    text-align: center;
    word-break: break-all;
    transition: opacity 0.2s ease;
  }

  .notice-info {
    background: var(--paper-3);
    color: var(--ink-2);
    border: 1px solid var(--border-soft);
  }

  .notice-success {
    background: var(--sage-soft);
    color: var(--sage-on);
    border: 1px solid var(--sage);
  }

  .notice-warning {
    background: var(--apricot-soft);
    color: var(--apricot-ink);
    border: 1px solid var(--apricot);
  }

  .notice-danger {
    background: rgba(186, 73, 73, 0.12);
    color: var(--danger-ink);
    border: 1px solid rgba(186, 73, 73, 0.25);
  }
</style>
