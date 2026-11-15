/* ===========================================================
   record/audioSession.svelte.js — 录音会话、Worker 离线分析与音频导入
   严格遵守核心边界：所有声学算法通过 ../../core/index.js 调用
   =========================================================== */

import { MicCapture, MicUnavailable } from '../../audio/capture.js';
import { TakeStore, thinCurve } from '../../store/takes.js';
import { LibraryStore } from '../../store/library.js';
import { CHECKUP_ITEMS } from '../../core/catalog.js';
import { extractAudioFrames, summarize, pitchName } from '../../core/index.js';
import { ui } from '../../state/ui.svelte.js';
import { settings } from '../../state/settings.svelte.js';
import { alertDlg } from '../../ui/dialog.js';

/** 将单声道 Float32Array 编码为 16-bit PCM WAV Blob，保证回放与导出通用兼容 */
export function encodeWavBlob(pcm, sampleRate) {
  if (!pcm || !pcm.length || !sampleRate) return null;
  const numSamples = pcm.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

let _worker = null;
let _workerSeq = 0;

function runWorkerSummarize(frames, pcm, sampleRate, mode, floorF0) {
  return new Promise((resolve) => {
    if (typeof Worker === 'undefined') {
      resolve(summarize(frames, pcm, sampleRate, mode, floorF0));
      return;
    }
    try {
      if (!_worker) {
        _worker = new Worker(new URL('../../analysis-worker.js', import.meta.url), { type: 'module' });
      }
      const id = ++_workerSeq;
      const cleanup = () => {
        _worker.removeEventListener('message', onMsg);
        _worker.removeEventListener('error', onErr);
      };
      const onMsg = (e) => {
        if (!e.data || e.data.id !== id) return;
        cleanup();
        if (e.data.ok) {
          resolve(e.data.out);
        } else {
          resolve(summarize(frames, pcm, sampleRate, mode, floorF0));
        }
      };
      const onErr = () => {
        cleanup();
        resolve(summarize(frames, pcm, sampleRate, mode, floorF0));
      };
      _worker.addEventListener('message', onMsg);
      _worker.addEventListener('error', onErr);
      _worker.postMessage({ id, frames, pcm, sampleRate, mode, floorF0 });
    } catch {
      resolve(summarize(frames, pcm, sampleRate, mode, floorF0));
    }
  });
}

function showMsg(msg) {
  if (typeof window !== 'undefined' && typeof window.showNotice === 'function') {
    window.showNotice(msg);
  }
}

function medianOf(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stepH1H2Band(v, prev) {
  if (v == null) return null;
  const H = 0.4;
  if (prev === 0) return v > -0.4 + H ? (v > 1.5 ? (v > 5.0 ? 3 : 2) : 1) : 0;
  if (prev === 1) {
    if (v <= -0.4 - H) return 0;
    if (v > 1.5 + H) return v > 5.0 + H ? 3 : 2;
    return 1;
  }
  if (prev === 2) {
    if (v <= 1.5 - H) return v <= -0.4 - H ? 0 : 1;
    if (v > 5.0 + H) return 3;
    return 2;
  }
  if (prev === 3) return v <= 5.0 - H ? (v <= 1.5 ? (v <= -0.4 ? 0 : 1) : 2) : 3;
  if (v <= -0.4) return 0;
  if (v <= 1.5) return 1;
  if (v <= 5.0) return 2;
  return 3;
}

function stepBalanceBand(b, prev) {
  if (b == null) return null;
  const H = 0.8;
  if (prev === 0) return b < -9 - H ? (b < -18 - H ? 2 : 1) : 0;
  if (prev === 1) {
    if (b >= -9 + H) return 0;
    if (b < -18 - H) return 2;
    return 1;
  }
  if (prev === 2) return b >= -18 + H ? (b >= -9 + H ? 0 : 1) : 2;
  if (b >= -9) return 0;
  if (b >= -18) return 1;
  return 2;
}

class AudioSessionState {
  mode = $state('free'); // 'free' | 'script' | 'checkup'
  saveToJournal = $state(true);
  recording = $state(false);
  analyzing = $state(false);
  elapsedSec = $state(0);

  liveHz = $state(null);
  liveNote = $state('等候发声');
  liveDb = $state(-60);
  liveH1H2 = $state(null);
  liveBalance = $state(null);
  liveH1H2Band = $state(null);
  liveBalanceBand = $state(null);

  activeSetId = $state(typeof window !== 'undefined' ? LibraryStore.getActiveSetId() : 'daily');
  activeCheckupId = $state('check_a');
  lineIdx = $state(0);
  selectedTakeId = $state(null);
  mirrorResult = $state(null);

  liveFrames = [];
  #mic = null;
  #tickTimer = null;
  #onFramePaint = null;
  #h1h2Win = [];
  #balWin = [];
  #emaH1H2 = null;
  #emaBal = null;
  #lastUiPublishAt = 0;
  #lastVoicedAt = 0;
  #lastPitchAt = 0;

  #resetLiveSmoothing() {
    this.liveHz = null;
    this.liveNote = '等候发声';
    this.liveH1H2 = null;
    this.liveBalance = null;
    this.liveH1H2Band = null;
    this.liveBalanceBand = null;
    this.#h1h2Win = [];
    this.#balWin = [];
    this.#emaH1H2 = null;
    this.#emaBal = null;
    this.#lastUiPublishAt = 0;
    this.#lastVoicedAt = 0;
    this.#lastPitchAt = 0;
  }

  get activeCheckup() {
    return CHECKUP_ITEMS.find((c) => c.id === this.activeCheckupId) || CHECKUP_ITEMS[0];
  }

  setMode(next) {
    if (this.recording || this.analyzing) return;
    if (['free', 'script', 'checkup'].includes(next)) {
      this.mode = next;
      this.mirrorResult = null;
    }
  }

  setActiveCheckup(id) {
    if (this.recording || this.analyzing) return;
    if (CHECKUP_ITEMS.some((c) => c.id === id)) {
      this.activeCheckupId = id;
      this.mirrorResult = null;
    }
  }

  refreshSet() {
    this.activeSetId = LibraryStore.getActiveSetId();
  }

  setActiveSet(setId) {
    LibraryStore.setActiveSetId(setId);
    this.activeSetId = setId;
    this.lineIdx = 0;
  }

  prevLine(total) {
    if (!total) return;
    this.lineIdx = (this.lineIdx - 1 + total) % total;
  }

  nextLine(total) {
    if (!total) return;
    this.lineIdx = (this.lineIdx + 1) % total;
  }

  toggleSaveToJournal() {
    this.saveToJournal = !this.saveToJournal;
    showMsg(this.saveToJournal ? '记入手帐：已开启' : '记入手帐：已关闭（仅实时照镜）');
  }

  setFramePaintHook(fn) {
    this.#onFramePaint = fn;
  }

  async startRecording() {
    if (this.recording || this.analyzing) return;
    this.mirrorResult = null;
    this.liveFrames = [];
    this.elapsedSec = 0;
    this.liveDb = -60;
    this.#resetLiveSmoothing();

    const mic = new MicCapture({ minHz: 65, maxHz: 600, threshold: 0.15 });
    try {
      await mic.open();
    } catch (err) {
      await mic.close();
      if (err instanceof MicUnavailable) {
        await alertDlg('麦克风暂时不可用', err.message || '请检查系统录音权限后再试。');
      } else {
        await alertDlg('无法开启录音', String(err?.message || err));
      }
      return;
    }

    this.#mic = mic;
    this.recording = true;
    if (typeof document !== 'undefined') document.body.classList.add('rec-on');

    const startedAt = performance.now();
    this.#tickTimer = setInterval(() => {
      this.elapsedSec = (performance.now() - startedAt) / 1000;
      if (this.elapsedSec >= (settings.maxRecSecs || 120)) {
        this.stopRecording();
      }
    }, 100);

    mic.start((f) => {
      this.liveFrames.push(f);
      if (this.liveFrames.length > 4800) this.liveFrames.shift();
      this.liveDb = Number.isFinite(f.db) ? f.db : -60;
      const now = performance.now();

      if (f.hz) {
        this.liveHz = Math.round(f.hz);
        this.liveNote = pitchName(f.hz);
        this.#lastPitchAt = now;
      } else if (this.#lastPitchAt > 0 && now - this.#lastPitchAt > 1600) {
        this.liveHz = null;
        this.liveNote = '等候发声';
        this.#lastPitchAt = 0;
      }

      // 仅在清晰有声帧采集轻重与音色，避免清辅音/换气声引发剧烈跳变
      const clearVoiced = f.hz != null && (f.clarity ?? 0) >= 0.65;
      if (clearVoiced) {
        this.#lastVoicedAt = now;
        if (f.h1h2Db != null) {
          this.#h1h2Win.push(f.h1h2Db);
          if (this.#h1h2Win.length > 5) this.#h1h2Win.shift();
          const med = medianOf(this.#h1h2Win);
          this.#emaH1H2 = this.#emaH1H2 == null ? med : this.#emaH1H2 * 0.72 + med * 0.28;
        }
        if (f.balance != null) {
          this.#balWin.push(f.balance);
          if (this.#balWin.length > 5) this.#balWin.shift();
          const med = medianOf(this.#balWin);
          this.#emaBal = this.#emaBal == null ? med : this.#emaBal * 0.72 + med * 0.28;
        }
        // 首帧立即显示，随后按 ~220ms 节流刷新显示并叠加阈值迟滞
        if (this.#lastUiPublishAt === 0 || now - this.#lastUiPublishAt >= 220) {
          this.#lastUiPublishAt = now;
          if (this.#emaH1H2 != null) {
            const v = parseFloat(this.#emaH1H2.toFixed(1));
            this.liveH1H2 = v;
            this.liveH1H2Band = stepH1H2Band(v, this.liveH1H2Band);
          }
          if (this.#emaBal != null) {
            const b = parseFloat(this.#emaBal.toFixed(1));
            this.liveBalance = b;
            this.liveBalanceBand = stepBalanceBand(b, this.liveBalanceBand);
          }
        }
      } else if (this.#lastVoicedAt > 0 && now - this.#lastVoicedAt > 1600) {
        this.#resetLiveSmoothing();
      }

      this.#onFramePaint?.(this.liveFrames);
    });
  }

  async stopRecording() {
    if (!this.recording || !this.#mic) return;
    const mic = this.#mic;
    this.#mic = null;
    this.recording = false;
    if (this.#tickTimer) {
      clearInterval(this.#tickTimer);
      this.#tickTimer = null;
    }
    if (typeof document !== 'undefined') document.body.classList.remove('rec-on');

    this.analyzing = true;
    try {
      const captured = await mic.stop();
      const deviceLabel = mic.deviceLabel || '';
      await mic.close();

      const { pcm, sampleRate, blob, frames, durationSec } = captured;
      const analysisMode = (this.mode === 'script' || this.mode === 'checkup') ? 'script' : 'free';
      const pcmSec = (pcm && sampleRate) ? (pcm.length / sampleRate) : 0;
      const pcmIntact = Boolean(pcm && pcm.length >= 2048 && !(durationSec > 1.2 && pcmSec < durationSec * 0.78));
      const pcmFrames = pcmIntact ? extractAudioFrames(pcm, sampleRate) : null;
      const liveVoiced = Array.isArray(frames)
        ? frames.filter((f) => f && f.hz != null && (f.clarity ?? 0) >= 0.58).length
        : 0;
      const pcmVoiced = pcmFrames
        ? pcmFrames.filter((f) => f && f.hz != null && (f.clarity ?? 0) >= 0.58).length
        : 0;
      // 若 ScriptProcessor 在 Android WebView 发生丢帧，回退使用实时 AnalyserNode 完整帧序列，避免丢失有效发声时长
      const usedFrames = (pcmFrames && (liveVoiced === 0 || pcmVoiced >= liveVoiced * 0.75))
        ? pcmFrames
        : frames;
      const usedPcm = pcmIntact ? pcm : (pcm && pcm.length >= 2048 ? pcm : null);
      const out = await runWorkerSummarize(usedFrames, usedPcm, sampleRate, analysisMode, settings.floorTargetHz);

      const fallbackVoiced = Array.isArray(usedFrames)
        ? usedFrames.filter((f) => f && f.hz != null && (f.clarity ?? 0) >= 0.58 && (f.db ?? -60) > -49).length
        : 0;
      const voicedSec = out?.stats?.ext?.voicedSec ?? ((out?.stats?.voicedCount ?? fallbackVoiced) * 0.025);
      const hasValidCheckS = this.mode === 'checkup'
        && this.activeCheckupId === 'check_s'
        && out?.stats?.sibilance?.centroidHz != null
        && (out.stats.sibilance.frameCount ?? 0) >= 8;

      if (!hasValidCheckS && voicedSec < 0.3) {
        this.mirrorResult = {
          ok: false,
          medianF0: null,
          h1h2: null,
          deltaF: null,
          summary: '有效发声不足 0.3 秒，未写入手账；贴近麦克风放松再试一次吧～',
        };
        showMsg('有效发声不足 0.3 秒，未写入手账', 2800);
        return;
      }

      if (!this.saveToJournal) {
        const f0 = out?.stats?.medianF0 ? `${Math.round(out.stats.medianF0)} Hz` : '未测出';
        const h12 = out?.stats?.spectral?.h1h2Db;
        const wStr = h12 != null ? ` · H1-H2 ${h12 > 0 ? '+' : ''}${h12} dB` : '';
        const sibHz = out?.stats?.sibilance?.centroidHz;
        const sibStr = sibHz != null ? ` · 咝音重心 ${Math.round(sibHz)} Hz` : '';
        this.mirrorResult = {
          ok: out.ok,
          medianF0: out?.stats?.medianF0 ?? null,
          h1h2: h12 ?? null,
          deltaF: out?.stats?.deltaF ?? null,
          summary: hasValidCheckS
            ? `清擦音照镜完成${sibStr}（未写入手账）`
            : `自由照镜完成：音高 ${f0}${wStr}（未写入手账）`,
        };
        showMsg(this.mirrorResult.summary, 3200);
        return;
      }

      const activeSet = this.mode === 'script' ? LibraryStore.getSet(this.activeSetId) : null;
      const activeCheck = this.mode === 'checkup' ? this.activeCheckup : null;
      const wavBlob = (pcmIntact ? encodeWavBlob(pcm, sampleRate) : null) || blob || encodeWavBlob(pcm, sampleRate) || null;
      const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

      const take = {
        id,
        ts: Date.now(),
        mode: this.mode === 'checkup' ? 'script' : this.mode,
        subMode: this.mode,
        setId: activeCheck ? activeCheck.id : (activeSet ? activeSet.id : null),
        setName: activeCheck
          ? activeCheck.name
          : (activeSet ? activeSet.name : '自由表达'),
        lineText: (() => {
          if (activeCheck) return activeCheck.prompt;
          if (!activeSet || !Array.isArray(activeSet.lines) || !activeSet.lines.length) return '';
          const rawLine = activeSet.lines[this.lineIdx % activeSet.lines.length];
          return typeof rawLine === 'string' ? rawLine : (rawLine?.text || '');
        })(),
        deviceLabel,
        durationSec: out.stats?.ext?.totalSec ?? durationSec,
        sampleRate,
        ok: out.ok,
        reasons: out.reasons || [],
        stats: out.stats,
        curve: thinCurve(usedFrames, out.stats?.tone?.creakFrames || null),
        blob: wavBlob,
        fav: false,
        stamp: null,
      };

      await TakeStore.put(take);
      this.selectedTakeId = take.id;
      await settings.refreshMetrics();

      if (settings.autoJump) {
        ui.navigate(`analysis/${take.id}`);
      } else {
        showMsg(out.ok ? '已保存本次练习，可随时点下方「分析」查看' : '已保存，但样本有效发声偏少，可在分析页查看细节');
      }
    } catch (err) {
      await alertDlg('分析遇到一点小波折', String(err?.message || err));
    } finally {
      this.analyzing = false;
    }
  }

  async importAudioFile(file) {
    if (!file || this.recording || this.analyzing) return;
    this.analyzing = true;
    try {
      const ab = await file.arrayBuffer();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const decoded = await ctx.decodeAudioData(ab.slice(0));
      const sampleRate = decoded.sampleRate;
      const chCount = decoded.numberOfChannels;
      const len = decoded.length;
      const pcm = new Float32Array(len);
      for (let c = 0; c < chCount; c++) {
        const data = decoded.getChannelData(c);
        for (let i = 0; i < len; i++) pcm[i] += data[i] / chCount;
      }
      try { await ctx.close(); } catch {}

      const frames = extractAudioFrames(pcm, sampleRate);
      const out = await runWorkerSummarize(frames, pcm, sampleRate, 'free', settings.floorTargetHz);
      const wavBlob = encodeWavBlob(pcm, sampleRate) || file;
      const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

      const take = {
        id,
        ts: Date.now(),
        mode: 'import',
        subMode: 'import',
        setId: null,
        setName: file.name ? file.name.replace(/\.[^.]+$/, '') : '导入音频',
        lineText: '',
        deviceLabel: '外部音频导入',
        durationSec: out.stats?.ext?.totalSec ?? (len / sampleRate),
        sampleRate,
        ok: out.ok,
        reasons: out.reasons || [],
        stats: out.stats,
        curve: thinCurve(frames, out.stats?.tone?.creakFrames || null),
        blob: wavBlob,
        fav: false,
        stamp: null,
      };

      await TakeStore.put(take);
      this.selectedTakeId = take.id;
      await settings.refreshMetrics();
      ui.navigate(`analysis/${take.id}`);
      showMsg('外部音频已完成声学分析');
    } catch (err) {
      await alertDlg('音频解码失败', '暂不支持该封装格式，建议使用 .wav / .mp3 / .m4a 常见音频文件。\n' + (err?.message || ''));
    } finally {
      this.analyzing = false;
    }
  }
}

export const audioSession = new AudioSessionState();
