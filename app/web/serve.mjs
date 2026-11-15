/**
 * 极简静态服务器（零依赖）
 * 用法：node app/serve.mjs [端口]
 * 电脑上用 http://localhost:8787 —— localhost 属于安全上下文，麦克风可用。
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.argv[2] || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
  '.ico':  'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';

    // 防目录穿越
    const abs = normalize(join(ROOT, p));
    if (!abs.startsWith(ROOT)) {
      res.writeHead(403).end('403');
      return;
    }

    const s = await stat(abs).catch(() => null);
    if (!s || s.isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
         .end('404 · 没有这个文件：' + p);
      return;
    }

    const buf = await readFile(abs);
    res.writeHead(200, {
      'content-type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('500 · ' + e.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);

  console.log('\n  练声音 · 本地预览\n');
  console.log(`  电脑：  http://localhost:${PORT}`);
  for (const ip of lan) {
    console.log(`  手机：  http://${ip}:${PORT}   ← 同一 Wi-Fi 下打开`);
  }
  if (lan.length) {
    console.log('\n  提示：手机上用 http:// 打开时浏览器不允许开麦克风。');
    console.log('       先看界面；录音功能在电脑上用，或稍后接入「录音导入」。');
  }
  console.log('');
});
