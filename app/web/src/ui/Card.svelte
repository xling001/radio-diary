<script>
  let {
    variant = 'paper', // 'paper' | 'hero' | 'note' | 'groove'
    title = '',
    note = '',
    padding = '',
    interactive = false,
    onclick = null,
    children,
    ...rest
  } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="dsh-card card-{variant} {interactive ? 'interactive' : ''}"
  style={padding ? `padding: ${padding};` : ''}
  role={interactive ? 'button' : undefined}
  tabindex={interactive ? 0 : undefined}
  onclick={onclick}
  onkeydown={(e) => {
    if (interactive && (e.key === 'Enter' || e.key === ' ')) {
      onclick?.(e);
    }
  }}
  {...rest}
>
  {#if title || note}
    <div class="card-head">
      {#if title}<span class="card-title">{title}</span>{/if}
      {#if note}<span class="card-head-note">{note}</span>{/if}
    </div>
  {/if}
  {@render children?.()}
</div>

<style>
  .dsh-card {
    position: relative;
    box-sizing: border-box;
    border-radius: var(--radius, 18px);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .interactive {
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .interactive:active {
    transform: scale(0.985);
  }

  /* 变体 */
  .card-paper {
    background: var(--paper-card);
    border: var(--edge, 1.2px solid var(--hairline));
    box-shadow: var(--shadow);
    padding: 16px;
    margin-bottom: 12px;
  }

  .card-hero {
    background: var(--paper-card);
    border: 1.2px solid var(--rose-soft);
    box-shadow: var(--shadow-lift);
    padding: 20px 16px;
    margin-bottom: 14px;
  }

  .card-note {
    background: var(--paper-3);
    border: 1px dashed var(--border-soft);
    border-radius: var(--radius-sm, 12px);
    padding: 12px 14px;
    margin-bottom: 12px;
  }

  .card-groove {
    background: var(--paper-groove);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-sm, 12px);
    padding: 12px;
    margin-bottom: 12px;
  }

  .card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
    gap: 8px;
  }

  .card-title {
    font-family: var(--font-title);
    font-size: var(--fs-16, 16px);
    font-weight: 600;
    color: var(--ink-1);
    letter-spacing: 0.02em;
  }

  .card-head-note {
    font-size: var(--fs-11, 11px);
    color: var(--ink-3);
  }
</style>
