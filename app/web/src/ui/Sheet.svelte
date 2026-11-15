<script>
  let {
    open = false,
    title = '',
    onclose = null,
    children,
    ...rest
  } = $props();

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) {
      onclose?.();
    }
  }
</script>

{#if open}
  <div
    class="dsh-sheet-backdrop"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={handleBackdropClick}
    onkeydown={(e) => { if (e.key === 'Escape') onclose?.(); }}
    {...rest}
  >
    <div class="dsh-sheet-container">
      <div class="sheet-drag-handle" aria-hidden="true"></div>

      {#if title}
        <div class="sheet-header">
          <h3 class="sheet-title">{title}</h3>
          <button class="sheet-close-btn" type="button" aria-label="关闭" onclick={() => onclose?.()}>
            ✕
          </button>
        </div>
      {/if}

      <div class="sheet-content">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  .dsh-sheet-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(30, 24, 20, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 0.18s ease-out;
  }

  .dsh-sheet-container {
    width: 100%;
    max-width: 520px;
    background: var(--paper-card);
    border-radius: var(--radius-lg, 24px) var(--radius-lg, 24px) 0 0;
    box-shadow: var(--shadow-lift);
    padding: 12px 18px calc(18px + env(safe-area-inset-bottom, 0px));
    animation: slideUp 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
    box-sizing: border-box;
  }

  .sheet-drag-handle {
    width: 36px;
    height: 4px;
    border-radius: 999px;
    background: var(--paper-groove);
    margin: 0 auto 12px;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .sheet-title {
    margin: 0;
    font-family: var(--font-title);
    font-size: var(--fs-19, 19px);
    font-weight: 600;
    color: var(--ink-1);
    letter-spacing: 0.02em;
  }

  .sheet-close-btn {
    background: transparent;
    border: none;
    font-size: 16px;
    color: var(--ink-3);
    cursor: pointer;
    padding: 6px;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
  }
  .sheet-close-btn:active {
    background: var(--paper-3);
  }

  .sheet-content {
    max-height: 75vh;
    overflow-y: auto;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
</style>
