<script>
  let {
    label = '',
    value = '—',
    unit = '',
    chipText = '',
    chipVariant = 'sage', // 'rose' | 'sage' | 'apricot' | 'slate'
    dim = false,
    interactive = false,
    onclick = null,
    children,
    ...rest
  } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="dsh-tile {dim ? 'dim' : ''} {interactive ? 'tile-interactive' : ''}"
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
  {#if label}
    <div class="tl">{label}</div>
  {/if}

  <div class="tv">
    {value}{#if unit}<small>{unit}</small>{/if}
  </div>

  {#if chipText}
    <span class="status-chip chip-{chipVariant}">{chipText}</span>
  {/if}

  {@render children?.()}
</div>

<style>
  .dsh-tile {
    position: relative;
    box-sizing: border-box;
    background: var(--paper-card);
    border: var(--edge-soft, 1px solid var(--border-soft));
    border-radius: var(--radius-sm, 12px);
    box-shadow: var(--shadow);
    padding: 10px 10px 9px;
    display: flex;
    flex-direction: column;
    min-height: 72px;
    transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  }

  .tile-interactive {
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .tile-interactive:active {
    transform: scale(0.96);
  }

  .tl {
    font-size: var(--fs-11, 11px);
    color: var(--ink-2);
    line-height: 1.2;
  }

  .tv {
    margin-top: 5px;
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
    font-size: var(--fs-19, 19px);
    font-weight: 600;
    line-height: 1.15;
    color: var(--ink-1);
    white-space: nowrap;
    word-break: keep-all;
  }

  .tv small {
    font-size: var(--fs-10, 10px);
    color: var(--ink-3);
    margin-left: 2px;
    vertical-align: baseline;
  }

  .dim .tv {
    color: var(--ink-3);
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    margin-top: 6px;
    padding: 2px 7px;
    border-radius: 999px;
    font-family: var(--font-ui, system-ui, sans-serif);
    font-size: var(--fs-10, 10px);
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
  }

  .chip-rose    { background: var(--rose-soft); color: var(--rose-chip-ink); }
  .chip-sage    { background: var(--sage-soft); color: var(--sage-chip-ink); }
  .chip-apricot { background: var(--apricot-soft); color: var(--apricot-chip-ink); }
  .chip-slate   { background: var(--slate-soft); color: var(--slate-chip-ink); }
</style>
