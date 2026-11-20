import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './', // 必须：Android assets.local 下没有域名根
  build: {
    outDir: 'dist',
    target: ['es2020', 'chrome80', 'safari14'], // 兼容 Android 10+ / 更新过 WebView 的老机与 iOS Safari 14+
    assetsInlineLimit: 2048,
    modulePreload: false, // 禁用 modulePreload，消除 Android WebView MIME 拦截风险
    sourcemap: false,
  },
  worker: { format: 'es' }, // analysis-worker 保持 module worker
});
