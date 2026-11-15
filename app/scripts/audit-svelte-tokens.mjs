import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const srcDir = path.join(root, 'app/web/src');

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (f.endsWith('.svelte')) files.push(full);
  }
  return files;
}

const svelteFiles = walk(srcDir);

console.log(`=== 审计 ${svelteFiles.length} 个 Svelte 组件的 Token 与样式 ===\n`);

let totalHex = 0;
let totalRadiusPx = 0;
let fontTitleCount = 0;
let shadowCount = 0;

for (const file of svelteFiles) {
  const rel = path.relative(srcDir, file);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  const hexes = content.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const radiusPx = (content.match(/border-radius:\s*(?!999px)\d+px/g) || []);
  const hasFontTitle = content.includes('--font-title');
  const hasShadow = content.includes('--shadow');

  totalHex += hexes.length;
  totalRadiusPx += radiusPx.length;
  if (hasFontTitle) fontTitleCount++;
  if (hasShadow) shadowCount++;

  console.log(`${rel.padEnd(35)}: hex=${hexes.length}, radiusPx=${radiusPx.length}, fontTitle=${hasFontTitle}, shadow=${hasShadow}`);
}

console.log('\n--- 统计汇总 ---');
console.log(`组件总数: ${svelteFiles.length}`);
console.log(`Hex 出现次数: ${totalHex}`);
console.log(`硬编码 border-radius: Npx 出现次数: ${totalRadiusPx}`);
console.log(`使用 --font-title 的组件数: ${fontTitleCount}`);
console.log(`使用 --shadow 的组件数: ${shadowCount}`);
