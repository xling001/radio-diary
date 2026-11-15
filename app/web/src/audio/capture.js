/* ===========================================================
   audio/capture.js — 麦克风采集与逐帧测量

   两件事：
   1. 用 AudioContext 拿原始波形，逐帧喂给 YIN，产出 {t, hz, clarity, db}
   2. 用 MediaRecorder 同时留一份录音，供回放

   关键取舍：必须关掉浏览器的自动增益(AGC)、降噪(NS)、回声消除(EC)。
   它们会让音量变得不可测，而音量是"这次先不算"的主要判据之一。
   =========================================================== */

import { Yin, downsample, WORK_RATE } from '../dsp/pitch.js';
import { powerSpectrum, bandRatioDb } from '../dsp/fft.js';

const HOP_MS = 25;
const SPECTRUM_N = 2048;      // 48k 下约 43 ms，够算频带能量

export class MicUnavailable extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MicUnavailable';
    this.code = code;
  }
}

export function micSupportCheck() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: 'no-api', message: '这个浏览器没有麦克风接口。' };
  }
  if (!window.isSecureContext) {
    return {
      ok: false,
      reason: 'insecure',
      message: '当前地址不是安全来源，浏览器不给开麦克风。用 localhost 打开，或者换成 https。',
    };
  }
  return { ok: true };
}

export class MicCapture {
  constructor({ minHz = 65, maxHz = 600, threshold = 0.14 } = {}) {
    this.opts = { minHz, maxHz, threshold };
    this.ctx = null;
    this.stream = null;
    this.analyser = null;
    this.recorder = null;
    this.chunks = [];
    this.timer = null;
    this.startedAt = 0;
    this.frames = [];
    this.pitch = null;
    this.tap = null;          // 降采样后的残余缓冲（保持帧间连续）
  }

  /** 申请麦克风。失败时抛 MicUnavailable，带可读原因。 */
  async open() {
    const support = micSupportCheck();
    if (!support.ok) throw new MicUnavailable(support.reason, support.message);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (e) {
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new MicUnavailable('denied', '麦克风被拒绝了。在地址栏的权限里允许一次。');
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new MicUnavailable('no-device', '没找到可用的麦克风。');
      }
      throw new MicUnavailable('unknown', '打不开麦克风：' + (e?.message || name));
    }

    this.stream = stream;
    // 记下这一次用的是哪个输入设备。换手机、换蓝牙耳机之后，明亮度和 HNR
    // 会整体漂移一段，那会被误读成「进步」。有了标签，界面才能说清楚
    // "这两条不是在同一支麦克风上量的"。
    try {
      const track = stream.getAudioTracks && stream.getAudioTracks()[0];
      this.deviceLabel = (track && track.label) || '';
    } catch { this.deviceLabel = ''; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const src = this.ctx.createMediaStreamSource(stream);
    this.src = src;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser);

    // 原生无损 PCM 缓冲捕获：100% 留存原始浮点样本，杜绝 decodeAudioData 解码失败
    this.pcmChunks = [];
    this.recording = false;
    if (typeof this.ctx.createScriptProcessor === 'function') {
      try {
        this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
        this.silentGain = this.ctx.createGain();
        this.silentGain.gain.value = 0;
        src.connect(this.processor);
        this.processor.connect(this.silentGain);
        this.silentGain.connect(this.ctx.destination);
        this.processor.onaudioprocess = (e) => {
          if (!this.recording) return;
          const ch = e.inputBuffer.getChannelData(0);
          this.pcmChunks.push(new Float32Array(ch));
        };
      } catch {
        this.processor = null;
      }
    }

    this.pitch = new Yin({
      sampleRate: WORK_RATE,
      minHz: this.opts.minHz,
      maxHz: this.opts.maxHz,
      threshold: this.opts.threshold,
      windowSize: 1024,
    });
    this.raw = new Float32Array(this.analyser.fftSize);

    return { sampleRate: this.ctx.sampleRate };
  }

  /**
   * 开始录制与实时测量。
   * @param {(f:{t:number,hz:number|null,clarity:number,db:number}) => void} onFrame
   */
  start(onFrame) {
    if (!this.ctx) throw new Error('先 open() 再 start()');

    this.frames = [];
    this.startedAt = performance.now();
    this.tap = new Float32Array(0);
    this.pcmChunks = [];
    this.recording = true;

    // 记录一份音频
    this.chunks = [];
    try {
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
      this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) this.chunks.push(e.data);
      };
      this.recorder.start(250);
    } catch {
      this.recorder = null;   // 录不了音频也要能测
    }

    this.timer = setInterval(() => {
      const f = this._measure();
      if (!f) return;
      this.frames.push(f);
      if (onFrame) onFrame(f);
    }, HOP_MS);
  }

  _measure() {
    const a = this.analyser;
    if (!a) return null;
    a.getFloatTimeDomainData(this.raw);

    // 电平
    let sum = 0;
    for (let i = 0; i < this.raw.length; i++) sum += this.raw[i] * this.raw[i];
    const rms = Math.sqrt(sum / this.raw.length);
    const db = 20 * Math.log10(rms + 1e-12);

    // 活跃能量门控 (Active Noise Gate)：环境底噪或弱音直接判静音，防止环境音一惊一乍
    const tNow = (performance.now() - this.startedAt) / 1000;
    // 同 main.js：只挡明显静音，不放行真正的判断（相对门限在 gating 里按 p95 算）。
    // 原值 -43 dBFS 会让小增益麦克风整段被判静音。
    if (db < -58) {
      return { t: tNow, hz: null, clarity: 0, db, balance: null };
    }

    // 降采样到 16k，并与上一帧残余拼接，保证 64ms 窗连续
    const ds = downsample(this.raw, this.ctx.sampleRate, WORK_RATE);
    const joined = new Float32Array(this.tap.length + ds.length);
    joined.set(this.tap, 0);
    joined.set(ds, this.tap.length);

    // 传够 yin.needed 个样本（windowSize + tauMax）。写死 1024 会让低音系统性偏高。
    const W = this.pitch.needed;
    if (joined.length < W) {
      this.tap = joined;
      return { t: tNow, hz: null, clarity: 0, db, balance: null };
    }

    const frame = joined.subarray(joined.length - W);
    const res = this.pitch.detect(frame);
    this.tap = joined.subarray(joined.length - 256);   // 留一点重叠

    // 周期置信度门限：只有明确有声帧才输出有效基频
    const isVoiced = res && res.clarity >= 0.58 && res.hz >= this.opts.minHz && res.hz <= this.opts.maxHz;

    // 明亮度与谐波谱分析
    let balance = null;
    let h1h2Db = null;
    let twangDb = null;

    if (rms > 1e-4) {
      const N = Math.min(SPECTRUM_N, this.raw.length);
      const spec = powerSpectrum(this.raw.subarray(this.raw.length - N), SPECTRUM_N);
      balance = bandRatioDb(spec, SPECTRUM_N, this.ctx.sampleRate, 100, 4000);

      // 若为有声帧，实时提取第一/第二谐波比与咽腔共鸣比
      if (isVoiced && res.hz >= 75 && res.hz <= 550) {
        const sampleRate = this.ctx.sampleRate;
        const binHz = sampleRate / SPECTRUM_N;
        const half = SPECTRUM_N / 2;
        const f0 = res.hz;

        const lo1 = Math.max(1, Math.floor((f0 * 0.65) / binHz));
        const hi1 = Math.min(half - 1, Math.ceil((f0 * 1.35) / binHz));
        let max1 = 0;
        for (let k = lo1; k <= hi1; k++) if (spec[k] > max1) max1 = spec[k];

        const lo2 = Math.max(1, Math.floor((2 * f0 - f0 * 0.35) / binHz));
        const hi2 = Math.min(half - 1, Math.ceil((2 * f0 + f0 * 0.35) / binHz));
        let max2 = 0;
        for (let k = lo2; k <= hi2; k++) if (spec[k] > max2) max2 = spec[k];

        if (max1 > 1e-10 && max2 > 1e-10) {
          const d12 = 10 * Math.log10(max1 / max2); // spec 为幅度的平方，10*log10(p1/p2) == 20*log10(a1/a2)
          if (d12 > -18 && d12 < 18) h1h2Db = parseFloat(d12.toFixed(1));
        }

        const bLow1 = Math.max(1, Math.floor(400 / binHz));
        const bLow2 = Math.min(half - 1, Math.ceil(1500 / binHz));
        const bHi1 = Math.max(1, Math.floor(2200 / binHz));
        const bHi2 = Math.min(half - 1, Math.ceil(4200 / binHz));
        let lowMidEnergy = 0;
        let twangEnergy = 0;
        for (let b = bLow1; b <= bLow2; b++) lowMidEnergy += spec[b];
        for (let b = bHi1; b <= bHi2; b++) twangEnergy += spec[b];
        if (lowMidEnergy > 1e-10 && twangEnergy > 1e-10) {
          twangDb = parseFloat((10 * Math.log10(twangEnergy / lowMidEnergy)).toFixed(1));
        }
      }
    }

    return {
      t: tNow,
      hz: isVoiced ? res.hz : null,
      clarity: res ? res.clarity : 0,
      db,
      balance,
      h1h2Db,
      twangDb,
    };
  }

  /** 停止。返回录音 blob（可能为 null）、PCM 裸流与帧序列。 */
  async stop() {
    this.recording = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }

    const durationSec = (performance.now() - this.startedAt) / 1000;

    let blob = null;
    if (this.recorder && this.recorder.state !== 'inactive') {
      blob = await new Promise((resolve) => {
        this.recorder.onstop = () => {
          resolve(this.chunks.length ? new Blob(this.chunks, { type: this.chunks[0].type }) : null);
        };
        try { this.recorder.stop(); } catch { resolve(null); }
      });
    }

    let pcm = null;
    let sampleRate = this.ctx ? this.ctx.sampleRate : 48000;

    // 优先采用 ScriptProcessor 录到的原始全精度无损 PCM，绝不因解码失败丢失数据
    if (this.pcmChunks && this.pcmChunks.length > 0) {
      let totalSamples = 0;
      for (const chunk of this.pcmChunks) totalSamples += chunk.length;
      pcm = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of this.pcmChunks) {
        pcm.set(chunk, offset);
        offset += chunk.length;
      }
      this.pcmChunks = [];
    }

    // 兜底容错：若未捕获到 PCM 或 ScriptProcessor 在 WebView 主线程繁忙时丢帧导致 PCM 明显短于录音时长，尝试解码 MediaRecorder 音频补全
    const pcmSec = pcm && sampleRate ? pcm.length / sampleRate : 0;
    const pcmIncomplete = !pcm || pcm.length < 2048 || (durationSec > 1.2 && pcmSec < durationSec * 0.78);
    if (pcmIncomplete && blob && this.ctx) {
      try {
        const ab = await blob.arrayBuffer();
        const decoded = await this.ctx.decodeAudioData(ab.slice(0));
        const decodedPcm = decoded.getChannelData(0);
        if (decodedPcm && decodedPcm.length > (pcm ? pcm.length * 1.15 : 0)) {
          pcm = new Float32Array(decodedPcm);
          if (decoded.sampleRate) sampleRate = decoded.sampleRate;
        }
      } catch (e) {
        // 部分浏览器不支持直接解码 webm，做静默容错
      }
    }

    return { blob, pcm, sampleRate, frames: this.frames, durationSec };
  }

  /** 释放设备与上下文 */
  async close() {
    this.recording = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.recorder && this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch { /* 忽略 */ }
    }
    if (this.processor) {
      try {
        this.src?.disconnect(this.processor);
        this.processor.disconnect();
        this.silentGain?.disconnect();
      } catch {}
      this.processor = null;
      this.silentGain = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.ctx) {
      try { await this.ctx.close(); } catch { /* 忽略 */ }
      this.ctx = null;
    }
    this.analyser = null;
  }
}

/**
 * 从离线 PCM 音频中提取标准帧序列（与在线录音及音频导入 100% 对齐）
 * @param {Float32Array} pcm - 单声道音频样本
 * @param {number} sampleRate - 采样率
 * @param {object} [opts]
 * @param {number} [opts.minHz=65]
 * @param {number} [opts.maxHz=600]
 * @param {number} [opts.threshold=0.14]
 * @param {number} [opts.silenceDb=-60]
 * @param {number} [opts.minClarity=0.58]
 * @returns {Array<{t: number, hz: number|null, clarity: number, db: number, balance: number|null}>}
 */
export function extractAudioFrames(pcm, sampleRate, opts = {}) {
  const minHz = opts.minHz ?? 65;
  const maxHz = opts.maxHz ?? 600;
  const threshold = opts.threshold ?? 0.14;
  const silenceDb = opts.silenceDb ?? -60;
  const minClarity = opts.minClarity ?? 0.58;

  const hopSamples = Math.round(sampleRate * 0.025);
  const winSamples = Math.min(4096, pcm.length);
  const frames = [];
  const yin = new Yin({
    sampleRate: WORK_RATE,
    minHz,
    maxHz,
    threshold,
    windowSize: 1024,
  });

  for (let offset = 0; offset + winSamples <= pcm.length; offset += hopSamples) {
    const t = (offset + winSamples / 2) / sampleRate;
    const win = pcm.subarray(offset, offset + winSamples);

    // RMS 电平
    let sum = 0;
    for (let i = 0; i < win.length; i++) sum += win[i] * win[i];
    const rms = Math.sqrt(sum / win.length);
    const db = 20 * Math.log10(rms + 1e-12);

    if (db < silenceDb) {
      frames.push({ t, hz: null, clarity: 0, db, balance: null });
      continue;
    }

    const ds = downsample(win, sampleRate, WORK_RATE);
    // 传够 yin.needed（= windowSize + tauMax）个样本：少给会推高音高
    const res = yin.detect(ds.subarray(Math.max(0, ds.length - yin.needed)));
    const isVoiced = res && res.clarity >= minClarity && res.hz >= minHz && res.hz <= maxHz;

    let balance = null;
    if (rms > 1e-4) {
      const spec = powerSpectrum(win.subarray(win.length - 2048), 2048);
      balance = bandRatioDb(spec, 2048, sampleRate, 100, 4000);
    }

    frames.push({
      t,
      hz: isVoiced ? res.hz : null,
      clarity: res ? res.clarity : 0,
      db,
      balance,
    });
  }

  return frames;
}
