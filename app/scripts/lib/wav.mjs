/**
 * lib/wav.mjs — 最小 PCM16 WAV 读取（单声道/多声道下混）
 */
import fs from 'node:fs';

export function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${file} 不是 WAV`);
  }
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(buf.length, body + size));
    }
    off = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${file} 缺少 fmt/data 块`);
  if (fmt.bits !== 16) throw new Error(`${file} 只支持 16 bit，实际 ${fmt.bits}`);

  const n = Math.floor(data.length / 2 / fmt.channels);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.channels; c++) {
      acc += data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
    }
    pcm[i] = acc / fmt.channels;
  }
  return { pcm, sampleRate: fmt.sampleRate };
}
