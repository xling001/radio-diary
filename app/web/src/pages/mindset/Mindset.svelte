<script>
  import { ui } from '../../state/ui.svelte.js';
  import Catalog from './Catalog.svelte';
  import Reader from './Reader.svelte';

  const activeChapter = $derived(ui.currentView === 'mindset' ? ui.subRoute : null);
</script>

{#if activeChapter}
  <Reader chapterId={activeChapter} />
{:else}
  <Catalog />
{/if}
