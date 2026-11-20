<script>
  import { onMount } from 'svelte';
  import {
    normalizeStats,
    evaluateH1H2,
    evaluateDeltaF,
    evaluateSpan,
    evaluateJitter,
    evaluateShimmer,
    evaluateSibilance,
    pitchName,
  } from '../../core/index.js';
  import { exportTakeMarkdown } from '../../core/export.js';
  import { TakeStore, subscribeTakes } from '../../store/takes.js';
  import { ui } from '../../state/ui.svelte.js';
  import { settings } from '../../state/settings.svelte.js';
  import { confirmDlg } from '../../ui/dialog.js';
  import Empty from '../../ui/Empty.svelte';
  import MoodStampModal from './MoodStampModal.svelte';
  import { audioSession } from '../record/audioSession.svelte.js';
  import {
    paintHarmonicsAndQuadrant,
    paintPitchTrack,
    paintVowelSpace,
    buildAiPrompt,
    exportTakeAudioWav,
  } from './charts.js';

  let take = $state(null);
  let loading = $state(true);
  let stampOpen = $state(false);
  let drawerOpen = $state(false);

  let heroCanvas = $state(null);
  let pitchCanvas = $state(null);
  let vowelCanvas = $state(null);

  let audioUrl = $state(null);
  let audioEl = $state(null);
  let isPlaying = $state(false);
  let playSec = $state(0);
  let audioDuration = $state(0);
  let seeking = $state(false);

  const ns = $derived(take ? normalizeStats(take) : null);
  const effectiveDuration = $derived(
    audioDuration > 0
      ? audioDuration
      : (ns?.totalSec || take?.durationSec || 0)
  );
  const playPct = $derived(
    effectiveDuration > 0
      ? Math.max(0, Math.min(100, (playSec / effectiveDuration) * 100))
      : 0
  );

  function revokeAudio() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
    isPlaying = false;
    playSec = 0;
    audioDuration = 0;
    seeking = false;
  }

  async function loadTargetTake() {
    loading = true;
    try {
      const targetId = (ui.currentView === 'analysis' && ui.subRoute)
        ? ui.subRoute
        : audioSession.selectedTakeId;
      let loaded = null;
      if (targetId) {
        loaded = await TakeStore.get(targetId);
      }
      if (!loaded) {
        const list = await TakeStore.all();
        loaded = list[0] || null;
      }
      revokeAudio();
      take = loaded;
      if (loaded) {
        const fallbackDur = Number(
          loaded.durationSec
          || loaded.stats?.ext?.totalSec
          || loaded.stats?.durationSec
          || 0
        );
        if (Number.isFinite(fallbackDur) && fallbackDur > 0) {
          audioDuration = fallbackDur;
        }
      }
      if (loaded?.blob) {
        audioUrl = URL.createObjectURL(loaded.blob);
      }
      if (loaded) audioSession.selectedTakeId = loaded.id;
    } finally {
      loading = false;
      requestAnimationFrame(drawCharts);
    }
  }

  function drawCharts() {
    if (!ns || !take) return;
    if (heroCanvas) paintHarmonicsAndQuadrant(heroCanvas, ns);
    if (drawerOpen) {
      if (pitchCanvas) paintPitchTrack(pitchCanvas, take, settings.floorTargetHz);
      if (vowelCanvas) paintVowelSpace(vowelCanvas, ns);
    }
  }

  onMount(() => {
    loadTargetTake();
    const unsubUi = ui.subscribe((route) => {
      if (route.view === 'analysis') loadTargetTake();
    });
    const unsubTakes = subscribeTakes(() => {
      if (ui.currentView === 'analysis') loadTargetTake();
    });
    const onTheme = () => requestAnimationFrame(drawCharts);
    window.addEventListener('tv-theme-change', onTheme);
    window.addEventListener('resize', drawCharts);

    return () => {
      unsubUi();
      unsubTakes();
      revokeAudio();
      window.removeEventListener('tv-theme-change', onTheme);
      window.removeEventListener('resize', drawCharts);
    };
  });

  $effect(() => {
    const _open = drawerOpen;
    if (ns && take) {
      requestAnimationFrame(drawCharts);
    }
  });

  function showMsg(msg) {
    if (typeof window !== 'undefined' && typeof window.showNotice === 'function') {
      window.showNotice(msg);
    }
  }

  function fmtNum(v, digits = 1, unit = '') {
    if (v == null || !Number.isFinite(v)) return '—';
    return `${v.toFixed(digits)}${unit}`;
  }

  function fmtSigned(v, digits = 1, unit = '') {
    if (v == null || !Number.isFinite(v)) return '—';
    return `${v > 0 ? '+' : ''}${v.toFixed(digits)}${unit}`;
  }

  function formatDateTime(ts) {
    const d = new Date(ts || Date.now());
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}月${day}日 ${hh}:${mm}`;
  }

  function formatPlayTime(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const rem = String(s % 60).padStart(2, '0');
    return `${m}:${rem}`;
  }

  function syncAudioDuration() {
    if (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
      audioDuration = audioEl.duration;
    }
  }

  function handleTimeUpdate() {
    if (!audioEl) return;
    syncAudioDuration();
    if (!seeking) {
      playSec = audioEl.currentTime || 0;
    }
  }

  function handleSeekInput(e) {
    const nextSec = Number(e.currentTarget.value) || 0;
    playSec = nextSec;
    if (audioEl) {
      audioEl.currentTime = nextSec;
    }
  }

  function togglePlay() {
    if (!audioEl || !audioUrl) {
      showMsg('这条记录没有可播放的音频');
      return;
    }
    if (audioEl.paused) {
      if (effectiveDuration > 0 && playSec >= effectiveDuration - 0.05) {
        playSec = 0;
        audioEl.currentTime = 0;
      }
      audioEl.play().then(() => { isPlaying = true; }).catch(() => showMsg('音频播放受限'));
    } else {
      audioEl.pause();
      isPlaying = false;
    }
  }

  async function saveStamp(stampObj) {
    if (!take) return;
    const updated = { ...take, stamp: stampObj };
    await TakeStore.put(updated);
    take = updated;
    showMsg('体感印章已贴好');
  }

  async function toggleFav() {
    if (!take) return;
    const updated = { ...take, fav: !take.fav };
    await TakeStore.put(updated);
    take = updated;
    showMsg(updated.fav ? '已加入手账精选' : '已取消收藏');
  }

  async function copyAiText(mode) {
    if (!take || !ns) return;
    const text = buildAiPrompt(take, ns, mode);
    try {
      await navigator.clipboard.writeText(text);
      showMsg(mode === 'rich' ? '已复制 AI 深度问诊提示词，去发给 AI 聊聊吧' : '已复制简洁复盘数据');
    } catch {
      showMsg('当前环境不支持自动剪贴板，请改用导出 Markdown');
    }
  }

  async function handleExportMd() {
    if (!take) return;
    const res = await exportTakeMarkdown(take, { format: 'consultation' });
    if (res?.path) showMsg(`已保存至 ${res.path}`);
    else if (!res?.cancelled) showMsg('已生成并导出 Markdown 分析手账');
  }

  async function handleExportWav() {
    if (!take) return;
    const res = await exportTakeAudioWav(take);
    if (res.ok) showMsg(res.path ? `已保存至 ${res.path}` : `已导出音频 ${res.fileName}`);
    else if (!res.cancelled) showMsg(res.message || '音频导出未完成');
  }

  async function handleDeleteTake() {
    if (!take) return;
    const ok = await confirmDlg('删掉这条录音与分析？', '删掉后无法恢复。', '删掉', '先留着', true);
    if (!ok) return;
    await TakeStore.remove(take.id);
    await settings.refreshMetrics();
    audioSession.selectedTakeId = null;
    showMsg('已删除记录');
    ui.navigate('history');
  }

  const capsuleTone = $derived.by(() => {
    if (!ns) return 'tone-lavender';
    if (ns.isDuckVoice || ns.isPressed || (ns.quadrant?.y ?? 0) >= 0.35) return 'tone-coral';
    if (ns.bottleneckHint || (ns.quadrant?.x ?? 0) <= -0.22 || (ns.quadrant?.y ?? 0) >= 0.20) return 'tone-lavender';
    if ((ns.quadrant?.x ?? 0) >= 0.12 && (ns.quadrant?.y ?? 0) <= 0.12) return 'tone-mint';
    return 'tone-sky';
  });

  const hasSpectralVisual = $derived.by(() => {
    if (!ns) return false;
    return !!(
      ns.medianF0
      || ns.deltaF != null
      || ns.effDeltaF != null
      || ns.h1h2 != null
      || ns.harmonicsRelDb
      || ns.harmonicsDb
      || ns.harmonicsBars
    );
  });

  const pitchPercentPos = $derived.by(() => {
    const hz = ns?.medianF0;
    if (!hz) return null;
    return Math.max(4, Math.min(96, ((hz - 85) / (290 - 85)) * 100));
  });

  const floorPercentPos = $derived.by(() => {
    const hz = ns?.floorTargetHz || settings.floorTargetHz || 160;
    return Math.max(4, Math.min(96, ((hz - 85) / (290 - 85)) * 100));
  });

  const isCheckSOnly = $derived.by(() => !!(ns && !ns.medianF0 && ns.sibilanceCentroid != null));

  const subcardWeight = $derived.by(() => {
    if (!ns) return { verdict: '—', stat: '—', body: '' };
    const ev = evaluateH1H2(ns.h1h2);
    const recoveredTag = ns.h1h2Recovered ? '（由泛音峰差推算）' : '';
    const stat = `H1-H2 ${fmtSigned(ns.h1h2, 1, ' dB')}${recoveredTag}`;
    const intro = 'H1-H2 比较第一和第二泛音的能量差，用来大致看声带闭合是偏实还是偏轻柔。';
    const skipPct = ns.h1h2SkipPct ?? 0;
    const guardNote = (!ns.h1h2 && skipPct > 0)
      ? `（本次 ${skipPct}% 帧因 2f0 贴 F1 被跳过，已开启避让保护）`
      : ((!ns.h1h2 && ns.skippedByFormant > 0)
        ? `（检测到 ${ns.skippedByFormant} 帧共振峰靠近 2F0，已开启避让保护）`
        : ((ns.h1h2 != null && skipPct >= 10)
          ? `（已避让跳过 ${skipPct}% 2f0 贴 F1 的干扰帧）`
          : ''));
    const verdict = (ns.rawH1H2 != null && ns.spectralStatus)
      ? ns.spectralStatus
      : (ev.status || ev.label || '发声轻重待测');
    const tiltNote = (ns.h1h2 != null && ns.h1h2 < 1.8 && ns.spectralTiltDbOct != null && ns.spectralTiltDbOct > -6.5)
      ? ` 频谱倾斜约为 ${ns.spectralTiltDbOct.toFixed(1)} dB/oct，中低次谐波能量相对集中，听感可能会偏厚实一点。`
      : '';
    const resultNote = (ns.rawH1H2 != null && ns.spectralAdvice)
      ? ns.spectralAdvice
      : (ev.note || ev.chip || '可录一段 3 秒平稳的「啊 [a]」长音来查看发声轻重。');
    return {
      verdict,
      stat,
      body: `${intro} ${resultNote}${tiltNote}${guardNote}`,
    };
  });

  const subcardBright = $derived.by(() => {
    if (!ns) return { verdict: '—', stat: '—', body: '' };
    const dfVal = ns.deltaF ?? ns.effDeltaF;
    const ev = evaluateDeltaF(dfVal);
    const f2Dark = ns.f2 != null && ns.f2 < 1250 && ns.dominantVowel !== 'o';
    const h15 = ns.h1h5Db != null ? `H1-H5 ${fmtSigned(ns.h1h5Db, 1, ' dB')}` : '';
    const tilt = ns.spectralTiltDbOct != null ? `倾斜 ${fmtSigned(ns.spectralTiltDbOct, 1)} dB/oct` : '';
    const dfStr = dfVal != null ? `${ns.deltaF != null ? 'ΔF' : '估算 ΔF'} ${Math.round(dfVal)} Hz` : '';
    const f2Str = ns.f2 != null ? `F2 ${Math.round(ns.f2)} Hz` : '';

    let verdict = ev.status || ev.label || '共鸣亮度待前元音';
    if (f2Dark) {
      verdict = '舌位可能偏后 · 共鸣偏温厚';
    } else if (dfVal == null && ns.spectralTiltDbOct != null) {
      verdict = (ns.h1h2 != null && ns.h1h2 < 1.8)
        ? '中低谐波较集中（可再测前元音）'
        : (ns.spectralTiltDbOct >= -8.0 ? '高次谐波较多 · 偏清亮倾向' : '谐波分布相对均衡');
    }

    const intro = 'F2 主要反映舌位前后，ΔF 用来估算口腔前部共鸣空间；数值越高，声音往往听起来越靠前清亮。';
    const parts = [
      intro,
      ns.f2 != null
        ? `这次 F1=${ns.f1 ? Math.round(ns.f1) : '—'} / F2=${Math.round(ns.f2)} / F3=${ns.f3 ? Math.round(ns.f3) : '—'} Hz${f2Dark ? '，F2 偏低可能表示发音时舌位偏后或偏圆唇，听感会更偏温厚' : ''}。`
        : '',
      dfVal != null
        ? `${ns.deltaF != null ? '前腔共鸣间距 ΔF' : '估算共鸣间距 ΔF'} 约 ${Math.round(dfVal)} Hz，${ev.note ?? ev.chip ?? ''}`
        : '这次清晰前元音偏少，可在「做测试 → 衣音」平稳发 3 秒「衣」看前腔亮度。',
    ].filter(Boolean);

    return {
      verdict,
      stat: [f2Str, dfStr, h15, tilt].filter(Boolean).join(' · ') || '待测',
      body: parts.join(' '),
    };
  });

  const subcardPitch = $derived.by(() => {
    if (!ns) return { verdict: '—', stat: '—', body: '' };
    const f0 = ns.medianF0;
    const spanEv = evaluateSpan(ns.spanSt);
    let zoneTitle = ns.sibilanceCentroid != null ? '清擦音练习（无声带基频）' : '未测到稳定基频';
    if (f0) {
      if (f0 >= 175) {
        zoneTitle = ns.bottleneckHint
          ? '音高偏高 · 音色偏厚实'
          : '女声常见参考区间';
      } else if (f0 >= 145) {
        zoneTitle = '中性过渡区间';
      } else {
        zoneTitle = '低音基础区间';
      }
    }
    const f0Text = f0 ? `中位 ${Math.round(f0)} Hz (${pitchName(f0)})` : '中位 —';
    const spanText = ns.spanSt != null ? `音高起伏 ${ns.spanSt.toFixed(1)} st` : '';
    const floorText = ns.floorSafeRatio != null ? `托底 ${ns.floorSafeRatio}%` : '';
    const intro = '基频 (F0) 表示声带每秒振动的快慢，决定音高高低；音高起伏反映说话语调的变化幅度。';
    const spanBody = spanEv.note || spanEv.chip || '';
    const firstToneIssue = typeof ns.toneIssues?.[0] === 'string'
      ? ns.toneIssues[0]
      : (ns.toneIssues?.[0]?.desc || '');
    const resultPart = ns.toneSummary
      ? `这次测得中位音高约 ${f0 ? Math.round(f0) + ' Hz' : '—'}，${ns.toneSummary}${firstToneIssue ? '；' + firstToneIssue : ''}。`
      : `这次${spanBody}（参考托底线设为 ${ns.floorTargetHz || settings.floorTargetHz} Hz）。`;
    return {
      verdict: zoneTitle,
      stat: [f0Text, spanText, floorText].filter(Boolean).join(' · '),
      body: isCheckSOnly ? '清擦音「丝 [s]」发声时声带不振动，因此不统计音高与声调变化。' : `${intro} ${resultPart}`,
    };
  });

  const MOOD_EMOJI_MAP = {
    '轻松': '😊',
    '平稳': '😌',
    '顺畅满意': '✨',
    '很喜欢': '🌸',
    '摸索中': '🤔',
    '有点累': '😮‍💨',
    '略干紧': '💧',
    '抱抱自己': '🫂',
  };
  const MOOD_TONE_MAP = {
    '轻松': 'mint',
    '平稳': 'sky',
    '顺畅满意': 'mint',
    '很喜欢': 'coral',
    '摸索中': 'lavender',
    '有点累': 'indigo',
    '略干紧': 'lavender',
    '抱抱自己': 'coral',
  };

  function parseStamp(stamp) {
    if (!stamp) return null;
    const rawMood = String(stamp.mood || '😌 平稳').trim();
    const labelOnly = rawMood.replace(/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\u200D\s]+/gu, '').trim() || rawMood;
    const emojiMatch = rawMood.match(/^([\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\u200D]+)/u);
    const emoji = emojiMatch ? emojiMatch[1] : (MOOD_EMOJI_MAP[labelOnly] || '😌');
    const tone = stamp.tone || MOOD_TONE_MAP[labelOnly] || 'sky';
    const throats = Array.isArray(stamp.throats) && stamp.throats.length
      ? stamp.throats
      : (stamp.throat ? String(stamp.throat).split(/[·、,，]+/).map((s) => s.trim()).filter(Boolean) : []);
    return {
      emoji,
      label: labelOnly,
      fullMood: `${emoji} ${labelOnly}`,
      tone,
      throats,
      note: stamp.note || '',
    };
  }

  const parsedStamp = $derived(parseStamp(take?.stamp));

  const sibCard = $derived.by(() => {
    if (!ns) return { hasValue: false, hz: null, khzText: '—', status: '未检出明显擦音', pct: null, tip: '' };
    const intro = '这个指标看发「丝 [s]」时高频气流集中的位置，通常落在 6.0 ~ 8.5 kHz 会显得更清脆靠前。';
    const hz = ns.sibilanceCentroid;
    if (hz == null) {
      return {
        hasValue: false,
        hz: null,
        khzText: '—',
        status: isCheckSOnly ? '擦音时长偏短' : '未含明显 /s/ 段',
        pct: null,
        tip: `${intro} 这段录音里没有足够的 /s/ 片段，想专项观测可在「做测试 → 丝音」发 3 秒「丝—」。`,
      };
    }
    const sibEv = evaluateSibilance(hz);
    const pct = Math.max(4, Math.min(96, ((hz - 4000) / 6000) * 100));
    return {
      hasValue: true,
      hz: Math.round(hz),
      khzText: `${(hz / 1000).toFixed(2)} kHz`,
      status: sibEv.label || (hz >= 6000 ? '偏清脆前置' : '温和集中'),
      variant: sibEv.variant || 'slate',
      pct,
      tip: `${intro} 你这次测得约 ${(hz / 1000).toFixed(2)} kHz，${sibEv.note || sibEv.chip || ''}`,
    };
  });

  const vocalFoldCard = $derived.by(() => {
    if (!ns) return { pitchTag: '—', pitchTone: 'sky', lowConf: false, h12GuardNote: '', h12Val: '—', h12Tag: '待测', hnrVal: '—', hnrTag: '待测', jitVal: '—', jitTag: '待测', halvVal: '—', halvTag: '待测' };
    const lowConf = take?.ok === false;
    const f0 = ns.medianF0;
    let pitchTag = isCheckSOnly ? '清擦音无基频' : '基频待测';
    let pitchTone = 'sky';
    if (f0) {
      if (lowConf) {
        pitchTag = '样本受限 · 仅供参考';
        pitchTone = 'amber';
      } else if (f0 >= 175) {
        pitchTag = ns.bottleneckHint ? '音高较高 · 音色偏厚' : '高音区 (女声常见)';
        pitchTone = ns.bottleneckHint ? 'lavender' : 'mint';
      } else if (f0 >= 145) {
        pitchTag = '中性过渡区间';
        pitchTone = 'lavender';
      } else {
        pitchTag = '低音基础区';
        pitchTone = 'indigo';
      }
    }

    const hEv = evaluateH1H2(ns.h1h2);
    const hasFormantConflict = ns.h1h2 == null && !ns.quadrant?.isHum && (ns.h1h2GuardActive || ns.h1h2SkipPct > 0);
    const h12Val = ns.h1h2 != null
      ? `${fmtSigned(ns.h1h2, 1, ' dB')}`
      : (ns.quadrant?.isHum ? '不适用' : (hasFormantConflict ? '已避让保护' : '未测出'));
    const h12Tag = ns.h1h2 != null
      ? (lowConf
        ? '仅供参考（样本受限）'
        : (ns.h1h2Recovered ? `${hEv.chip || '谐波推算'} (推算)` : (ns.spectralStatus || hEv.chip || '已测')))
      : (ns.quadrant?.isHum
        ? '闭口哼鸣'
        : (hasFormantConflict ? 'F1 贴近二倍频，干净帧不足' : '有效浊音不足'));

    const hasDfAlongside = (ns.deltaF != null || ns.effDeltaF != null);
    const h12GuardNote = (hasFormantConflict && hasDfAlongside)
      ? '说明：音高与共鸣 ΔF 可用所有稳定帧计算，而 H1-H2 需要避开 F1 靠近二倍频的片段；这段里避让后干净帧不足 3 帧，因此单独留空以防失真，不代表两张卡矛盾～'
      : '';

    const hnrVal = ns.hnr != null ? `${ns.hnr.toFixed(1)} dB` : '—';
    const hnrTag = ns.hnr != null
      ? (lowConf ? '仅供参考（受限样本）' : (ns.hnr >= 15 ? '较清澈' : (ns.hnr >= 11 ? '平稳带柔气' : '略带气声')))
      : '待浊音样本';

    const jEv = evaluateJitter(ns.jitter);
    const sEv = evaluateShimmer(ns.shimmer);
    const stableJit = jEv.variant !== 'warn' && jEv.variant !== 'bad' && sEv.variant !== 'warn' && sEv.variant !== 'bad';
    const jitVal = (ns.jitter != null || ns.shimmer != null)
      ? `${ns.jitter != null ? ns.jitter.toFixed(2) + '%' : '—'} / ${ns.shimmer != null ? ns.shimmer.toFixed(1) + '%' : '—'}`
      : '—';
    const jitTag = (ns.jitter != null || ns.shimmer != null)
      ? (lowConf ? '仅供参考' : (stableJit ? '振动较稳' : '略有起伏'))
      : '待测';

    const halvVal = ns.pitchHalving != null ? `${ns.pitchHalving}%` : '—';
    const halvTag = ns.pitchHalving != null
      ? (lowConf ? '仅供参考' : (ns.pitchHalving >= 12 ? '偶有挤卡/假声感' : '较顺畅'))
      : '待测';

    return { pitchTag, pitchTone, lowConf, h12GuardNote, h12Val, h12Tag, hnrVal, hnrTag, jitVal, jitTag, halvVal, halvTag };
  });
</script>

<div class="ana-page">
  {#if loading}
    <div class="summary-sheet empty-wrap">正在整理这一次练习的数据…</div>
  {:else if !take || !ns}
    <div class="summary-sheet">
      <Empty
        title="还没有练习分析"
        desc="回到练习页录一段几秒钟的声音，这里会立即画好音高声带卡与谐波象限。"
        actionText="去录第一段声音"
        onaction={() => ui.navigate('record')}
      />
    </div>
  {:else}
    <!-- 已盖章时：体感印章展示卡置顶为第 1 张卡片；点击可再编辑 -->
    {#if parsedStamp}
      <button type="button" class="stamp-seal-card tone-{parsedStamp.tone}" onclick={() => { stampOpen = true; }}>
        <div class="seal-emblem" aria-hidden="true">{parsedStamp.emoji}</div>
        <div class="seal-content">
          <div class="seal-head">
            <strong class="seal-mood">{parsedStamp.label}</strong>
            {#if parsedStamp.throats.length}
              <div class="seal-tags-row">
                {#each parsedStamp.throats as tag}
                  <span class="seal-tag">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
          {#if parsedStamp.note}
            <p class="seal-note">{parsedStamp.note}</p>
          {/if}
        </div>
        <span class="seal-edit-hint">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>修改</span>
        </span>
      </button>
    {/if}

    <!-- 顶部记录头：单行操作栏 + 紧凑音频播放进度条 -->
    <div class="take-meta-bar">
      <div class="meta-top-row">
        <div class="meta-left">
          <strong class="meta-title">{take.setName || '自由表达'}</strong>
          <span class="meta-time">
            {formatDateTime(take.ts)} · {(!ns.voicedSec || ns.voicedSec <= 0)
              ? (ns.sibilanceCentroid != null ? '清擦音 [s] 样本' : '未测到稳定浊音')
              : ((effectiveDuration || take.durationSec)
                ? `全长 ${fmtNum(effectiveDuration || take.durationSec, 1, 's')}（有声 ${fmtNum(ns.voicedSec, 1, 's')}）`
                : `${fmtNum(ns.voicedSec, 1, 's')} 有声`)}
          </span>
        </div>
        <div class="meta-btns">
          <button type="button" class="mini-pill" onclick={togglePlay} disabled={!audioUrl}>
            {#if isPlaying}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1"></rect>
                <rect x="14" y="5" width="4" height="14" rx="1"></rect>
              </svg>
              <span>暂停</span>
            {:else}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="6 4 20 12 6 20 6 4"></polygon>
              </svg>
              <span>回放</span>
            {/if}
          </button>
          {#if !parsedStamp}
            <button type="button" class="mini-pill" onclick={() => { stampOpen = true; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
              <span>贴印章</span>
            </button>
          {/if}
          <button type="button" class="mini-pill icon-only {take.fav ? 'pill-fav' : ''}" onclick={toggleFav} aria-label="收藏">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={take.fav ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
        </div>
      </div>

      {#if audioUrl}
        <div class="meta-audio-bar">
          <input
            type="range"
            class="meta-seek-range"
            min="0"
            max={effectiveDuration > 0 ? effectiveDuration : 1}
            step="0.05"
            value={Math.min(playSec, effectiveDuration > 0 ? effectiveDuration : 1)}
            style={`--pct: ${playPct}%`}
            aria-label="播放进度"
            onpointerdown={() => { seeking = true; }}
            onpointerup={() => { seeking = false; }}
            onpointercancel={() => { seeking = false; }}
            oninput={handleSeekInput}
            onchange={() => { seeking = false; }}
          />
          <span class="meta-audio-time tnum">
            {formatPlayTime(playSec)} / {formatPlayTime(effectiveDuration)}
          </span>
        </div>
      {/if}
    </div>

    {#if audioUrl}
      <audio
        bind:this={audioEl}
        src={audioUrl}
        onloadedmetadata={syncAudioDuration}
        ondurationchange={syncAudioDuration}
        ontimeupdate={handleTimeUpdate}
        onended={() => { isPlaying = false; playSec = 0; }}
        onpause={() => { isPlaying = false; }}
        class="sr-hidden"
      ></audio>
    {/if}

    {#if take.restoredSummary && !audioUrl}
      <div class="gentle-warn" role="status">
        这是一条从手账备份恢复的文字与统计记录，未包含原始录音音频，数值与图表仍可正常回看。
      </div>
    {/if}

    {#if !take.ok}
      <div class="gentle-warn" role="status">
        {take.reasons?.length
          ? `本次录音条件受限（${take.reasons.join('；')}），以下声学数值仅作温和参考，建议重新录一段 3~6 秒清晰平稳的声音对比更准。`
          : '本次录音条件受限，以下声学数值仅作参考。'}
      </div>
    {/if}

    <!-- 第 1 张卡：基频音高与声带状况（频率 + 声带状态前置同卡） -->
    <section class="summary-sheet pitch-vocal-card" aria-label="基频音高与声带状况">
      <div class="hero-card-head">
        <span class="hero-card-title">音高与声带状态</span>
        <span class="zone-pill pill-{vocalFoldCard.pitchTone}">{vocalFoldCard.pitchTag}</span>
      </div>

      <div class="pv-pitch-hero">
        <div class="pv-main-val tnum {vocalFoldCard.lowConf ? 'vf-muted' : ''}">
          {#if isCheckSOnly}
            <span class="pv-hz">清擦音专项</span>
            <span class="pv-note">不计基频</span>
          {:else if ns.medianF0}
            <span class="pv-hz">{Math.round(ns.medianF0)} Hz</span>
            <span class="pv-note">{pitchName(ns.medianF0)}</span>
          {:else}
            <span class="pv-hz">—</span>
            <span class="pv-note">基频待测</span>
          {/if}
        </div>
        {#if !isCheckSOnly && ns.medianF0}
          <div class="pv-sub-nums tnum">
            <span>起伏 {ns.spanSt != null ? ns.spanSt.toFixed(1) + ' st' : '—'}</span>
            <span>·</span>
            <span>P10~P90 {ns.p10 && ns.p90 ? `${Math.round(ns.p10)}~${Math.round(ns.p90)}` : '—'}</span>
            <span>·</span>
            <span>托底 {ns.floorSafeRatio ?? '—'}% (底线 {ns.floorTargetHz || settings.floorTargetHz} Hz)</span>
          </div>
        {/if}
      </div>

      {#if !isCheckSOnly}
        <div class="pitch-zone-box">
          <div class="pz-track">
            <div class="pz-seg seg-low" title="低音区"></div>
            <div class="pz-seg seg-mid" title="中性过渡"></div>
            <div class="pz-seg seg-high" title="高音区（女声常见）"></div>
            <div class="pz-floor-tick" style={`left: ${floorPercentPos}%`} title="安全托底线"></div>
            {#if pitchPercentPos != null}
              <div class="pz-dot" style={`left: ${pitchPercentPos}%`}></div>
            {/if}
          </div>
          <div class="pz-labels">
            <span>低音 &lt;145</span>
            <span>过渡 145~175</span>
            <span>高音区 &gt;175 Hz</span>
          </div>
        </div>
      {/if}

      <div class="vf-grid {vocalFoldCard.lowConf ? 'vf-muted' : ''}">
        <div class="vf-cell">
          <span class="vf-lbl">发声轻重 (H1-H2)</span>
          <strong class="vf-val tnum">{vocalFoldCard.h12Val}</strong>
          <span class="vf-sub">{vocalFoldCard.h12Tag}</span>
        </div>
        <div class="vf-cell">
          <span class="vf-lbl">声音清澈度 (HNR)</span>
          <strong class="vf-val tnum">{vocalFoldCard.hnrVal}</strong>
          <span class="vf-sub">{vocalFoldCard.hnrTag}</span>
        </div>
        <div class="vf-cell">
          <span class="vf-lbl">抖动度 (Jitter / Shimmer)</span>
          <strong class="vf-val tnum">{vocalFoldCard.jitVal}</strong>
          <span class="vf-sub">{vocalFoldCard.jitTag}</span>
        </div>
        <div class="vf-cell {!vocalFoldCard.lowConf && ns.pitchHalving != null && ns.pitchHalving >= 12 ? 'vf-hint' : ''}">
          <span class="vf-lbl">假声 / 倍频占比</span>
          <strong class="vf-val tnum">{vocalFoldCard.halvVal}</strong>
          <span class="vf-sub">{vocalFoldCard.halvTag}</span>
        </div>
      </div>

      {#if vocalFoldCard.h12GuardNote}
        <p class="vf-guard-note" role="note">{vocalFoldCard.h12GuardNote}</p>
      {/if}

      {#if subcardPitch.body}
        <p class="pv-foot-note">{subcardPitch.body}</p>
      {/if}
    </section>

    <!-- 第 2 张卡：谐波 · 音色象限与共振峰 -->
    <div class="crayon-stage">
      <div class="summary-sheet hero-card">
        <div class="hero-card-head">
          <div class="vis-title-group">
            <span class="hero-card-title">音色象限与口腔共鸣</span>
            {#if ns.h1h2GuardActive && !ns.h1h2Recovered}
              <span class="guard-pill">已开启 F1 避让保护</span>
            {/if}
          </div>
        </div>

        {#if hasSpectralVisual}
          <div class="hero-canvas-wrap">
            <canvas bind:this={heroCanvas} class="hero-canvas"></canvas>
          </div>
          <div class="vis-legend" aria-hidden="true">
            <span class="leg-item"><span class="leg-dot"></span>圆点与光晕：本次位置与波动区间</span>
            <span class="leg-item"><span class="leg-zone"></span>绿虚线区：轻盈明亮参考范围</span>
          </div>
          {#if ns.quadrant?.axisNote}
            <p class="vis-note">{ns.quadrant.axisNote}</p>
          {/if}
        {:else if !isCheckSOnly}
          <div class="empty-vis-inline">
            这次未测到足够稳定的浊音元音，贴近麦克风平稳发 3 秒「啊」或「衣」即可看到谐波与共鸣位置。
          </div>
        {/if}

        <div class="formant-strip">
          <div class="ft-cell">
            <span class="ft-lbl">口腔开合 (F1)</span>
            <strong class="ft-val tnum">{ns.f1 ? `${Math.round(ns.f1)} Hz` : '待测'}</strong>
            <span class="ft-sub">{ns.formantDiag?.f1 || '开合度'}</span>
          </div>
          <div class="ft-cell {ns.f2 != null && ns.f2 < 1250 && ns.dominantVowel !== 'o' ? 'ft-hint' : ''}">
            <span class="ft-lbl">舌位前后 (F2)</span>
            <strong class="ft-val tnum">{ns.f2 ? `${Math.round(ns.f2)} Hz` : '待测'}</strong>
            <span class="ft-sub">{ns.formantDiag?.f2 || '明暗度'}</span>
          </div>
          <div class="ft-cell {ns.f3 != null && ns.f3 < 2620 ? 'ft-hint' : ''}">
            <span class="ft-lbl">前腔光泽 (F3)</span>
            <strong class="ft-val tnum">{ns.f3 ? `${Math.round(ns.f3)} Hz` : '待测'}</strong>
            <span class="ft-sub">{ns.formantDiag?.f3 || '光泽感'}</span>
          </div>
          <div class="ft-cell {(ns.deltaF ?? ns.effDeltaF) != null && (ns.deltaF ?? ns.effDeltaF) < 1050 ? 'ft-hint' : ''}">
            <span class="ft-lbl">{ns.deltaF != null ? '共鸣间距 (ΔF)' : '估算间距 (ΔF)'}</span>
            <strong class="ft-val tnum">
              {(ns.deltaF ?? ns.effDeltaF) != null ? `${Math.round(ns.deltaF ?? ns.effDeltaF)} Hz` : '待测'}
            </strong>
            <span class="ft-sub">{ns.formantDiag?.df || '参考尺度'}</span>
          </div>
        </div>

        {#if ns.bottleneckHint}
          <div class="mismatch-callout" role="note">
            <span class="mismatch-title">音高较高但听感偏厚时的可能原因</span>
            <p class="mismatch-text">{ns.bottleneckHint}</p>
          </div>
        {/if}
      </div>

      <div class="summary-capsule {capsuleTone}">
        {ns.quadrant?.summaryLabel || '自然平和的发声状态'}
      </div>
    </div>

    <!-- 第 3 张独立小卡：咝音清脆度 -->
    <section class="summary-sheet sib-card" aria-label="咝音重心分析">
      <div class="sib-head">
        <div class="sib-title-row">
          <span class="hero-card-title">咝音清脆度</span>
          <span
            class="sib-badge"
            class:badge-sage={sibCard.variant === 'sage'}
            class:badge-rose={sibCard.variant === 'rose'}
          >{sibCard.status}</span>
        </div>
        {#if sibCard.hasValue}
          <strong class="sib-val tnum">{sibCard.khzText}</strong>
        {/if}
      </div>

      {#if sibCard.hasValue}
        <div class="sib-ruler">
          <div class="sib-track">
            <div class="sib-target-band" title="6.0 ~ 8.5 kHz 清晰参考带"></div>
            <div
              class="sib-dot"
              class:dot-sage={sibCard.variant === 'sage'}
              class:dot-rose={sibCard.variant === 'rose'}
              style={`left: ${sibCard.pct}%`}
            ></div>
          </div>
          <div class="sib-labels tnum">
            <span>4.0 kHz 偏厚</span>
            <span>6.0 ~ 8.5 kHz 清脆带</span>
            <span>10.0 kHz</span>
          </div>
        </div>
      {/if}
      <p class="sib-tip">{sibCard.tip}</p>
    </section>

    <!-- 第 4 张卡：核心解读（保留文案插槽，轻盈免责副标题） -->
    <section class="summary-sheet" aria-label="指标怎么看">
      <h2 class="summary-sheet-title with-sub">指标怎么看</h2>
      <p class="summary-sheet-sub">数据仅作辅助参考，以自己听着舒服、喉咙不累为准～</p>
      <div class="subcard-stack">
        <article class="subcard">
          <div class="subcard-kicker">发声轻重 · H1-H2</div>
          <div class="subcard-head">
            <div class="subcard-verdict">{subcardWeight.verdict}</div>
            <div class="subcard-stat">
              {#each subcardWeight.stat.split(' · ') as tok, i}
                {#if i > 0}<span class="stat-sep"> · </span>{/if}<span class="stat-tok">{tok}</span>
              {/each}
            </div>
          </div>
          <p class="subcard-body">{subcardWeight.body}</p>
        </article>

        <article class="subcard">
          <div class="subcard-kicker">口腔共鸣 · F2 与 ΔF</div>
          <div class="subcard-head">
            <div class="subcard-verdict">{subcardBright.verdict}</div>
            <div class="subcard-stat">
              {#each subcardBright.stat.split(' · ') as tok, i}
                {#if i > 0}<span class="stat-sep"> · </span>{/if}<span class="stat-tok">{tok}</span>
              {/each}
            </div>
          </div>
          <p class="subcard-body">{subcardBright.body}</p>
        </article>
      </div>
    </section>

    <!-- 第 5 张卡：19+ 项详细指标与曲线抽屉（折叠探索，不喧宾夺主） -->
    <div class="summary-sheet drawer-sheet">
      <details class="deep-drawer" bind:open={drawerOpen}>
        <summary class="drawer-toggle">
          <span>查看全部详细指标与曲线（19+ 项）</span>
          <span class="drawer-arrow">
            <span>{drawerOpen ? '收起' : '展开'}</span>
            <svg class="drawer-chev {drawerOpen ? 'open' : ''}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </summary>

        <div class="drawer-body">
          <div class="mini-chart-block">
            <div class="mini-chart-title">音高随时间走向（珊瑚点为气泡音/嘎裂帧）</div>
            <canvas bind:this={pitchCanvas} class="detail-canvas"></canvas>
          </div>

          <div class="mini-chart-block">
            <div class="mini-chart-title">中文元音共鸣分布（按连续声道尺度归一化归类）</div>
            <canvas bind:this={vowelCanvas} class="detail-canvas vowel-canvas"></canvas>
            <div class="mini-chart-sub">虚线灰框：常见高共鸣轮廓（衣/啊/乌） · 实心彩点：本次实测；横轴向左代表舌位靠前，纵轴向上代表口腔收小。</div>
          </div>

          <div class="metrics-groups">
            <div class="metrics-group">
              <div class="mg-head">基频与音高</div>
              <div class="metrics-table">
                <div class="m-row"><span>中位基频 F0</span><strong class="tnum">{fmtNum(ns.medianF0, 1, ' Hz')}</strong></div>
                <div class="m-row"><span>均值基频 Mean F0</span><strong class="tnum">{fmtNum(ns.meanF0, 1, ' Hz')}</strong></div>
                <div class="m-row"><span>10%~90% 音高带</span><strong class="tnum">{ns.p10 && ns.p90 ? `${Math.round(ns.p10)} ~ ${Math.round(ns.p90)} Hz` : '—'}</strong></div>
                <div class="m-row"><span>音高起伏 (跨度 / 标准差)</span><strong class="tnum">{fmtNum(ns.spanSt, 1, ' st')} / std {fmtNum(ns.stdF0St, 2)}</strong></div>
                <div class="m-row"><span>低音 / 中性 / 女声占比</span><strong class="tnum">{ns.maleZonePct ?? '—'}% / {ns.midZonePct ?? '—'}% / {ns.femaleZonePct ?? '—'}%</strong></div>
                <div class="m-row"><span>安全托底达成率</span><strong class="tnum">{ns.floorSafeRatio ?? '—'}% ({ns.floorTargetHz || settings.floorTargetHz} Hz)</strong></div>
              </div>
            </div>

            <div class="metrics-group">
              <div class="mg-head">声道共鸣与唇齿</div>
              <div class="metrics-table">
                <div class="m-row"><span>平均共振峰间距 ΔF</span><strong class="tnum">{ns.deltaF != null ? `${Math.round(ns.deltaF)} Hz (≈ ${fmtNum(ns.lengthCm, 2, ' cm')})` : '—'}</strong></div>
                <div class="m-row"><span>共振峰均值 F1 / F2</span><strong class="tnum">{ns.f1 ? `${Math.round(ns.f1)} / ${ns.f2 ? Math.round(ns.f2) : '—'} Hz` : '—'}</strong></div>
                <div class="m-row"><span>高层共鸣均值 F3 / F4</span><strong class="tnum">{ns.f3 ? `${Math.round(ns.f3)} / ${ns.f4 ? Math.round(ns.f4) : '—'} Hz` : '—'}</strong></div>
                <div class="m-row"><span>相对声道尺度（元音归一）</span><strong class="tnum">{ns.vowelScale != null ? `${ns.vowelScale.toFixed(2)}×` : '—'}</strong></div>
                <div class="m-row"><span>咝音 [s] 频谱重心</span><strong class="tnum">{sibCard.khzText}</strong></div>
              </div>
            </div>

            <div class="metrics-group">
              <div class="mg-head">声门开商与音质</div>
              <div class="metrics-table">
                <div class="m-row"><span>H1-H2 声门轻重差</span><strong class="tnum">{fmtSigned(ns.h1h2, 1, ' dB')}</strong></div>
                <div class="m-row"><span>H1-H5 差与频谱倾斜</span><strong class="tnum">{fmtSigned(ns.h1h5Db, 1, ' dB')} / {fmtSigned(ns.spectralTiltDbOct, 1, ' dB/oct')}</strong></div>
                <div class="m-row"><span>Twang 明亮度（仅「衣」音参考）</span><strong class="tnum">{ns.twang != null ? `${fmtSigned(ns.twang, 1, ' dB')}（仅「衣」音）` : '仅「衣」音可用'}</strong></div>
                <div class="m-row"><span>吊嗓与假声挤卡率 (Pitch Halving)</span><strong id="a-v-halving" class="tnum">{ns.pitchHalving != null ? `${ns.pitchHalving}%` : '—'}</strong></div>
                <div class="m-row"><span>句尾气泡音 / 嘎裂占比</span><strong class="tnum">{ns.creakRatio != null ? `${ns.creakRatio}%` : '—'}</strong></div>
                <div class="m-row"><span>音高微抖动 Jitter</span><strong class="tnum">{fmtNum(ns.jitter, 2, ' %')}</strong></div>
                <div class="m-row"><span>音量微颤 Shimmer</span><strong class="tnum">{fmtNum(ns.shimmer, 2, ' %')}</strong></div>
                <div class="m-row"><span>谐噪比 HNR</span><strong class="tnum">{fmtNum(ns.hnr, 1, ' dB')}</strong></div>
              </div>
            </div>

            <div class="metrics-group">
              <div class="mg-head">样本与环境</div>
              <div class="metrics-table">
                <div class="m-row"><span>有声占比 / 均值响度</span><strong class="tnum">{ns.voicedPct ?? '—'}% / {fmtNum(ns.meanDb, 1, ' dBFS')}</strong></div>
                <div class="m-row"><span>输入设备标记</span><strong>{take.deviceLabel || '默认设备'}</strong></div>
              </div>
            </div>
          </div>

          <button type="button" class="del-take-btn" onclick={handleDeleteTake}>
            删除这条记录
          </button>
        </div>
      </details>
    </div>

    <!-- 第 6 张卡：复制给 AI 与导出操作区（纯净矢量图标） -->
    <div class="summary-sheet actions-card">
      <div class="action-grid">
        <button type="button" class="action-btn btn-primary-soft" onclick={() => copyAiText('rich')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>复制详细数据给 AI</span>
        </button>
        <button type="button" class="action-btn" onclick={() => copyAiText('brief')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          <span>复制简要数据</span>
        </button>
        <button type="button" class="action-btn" onclick={handleExportMd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <polyline points="9 15 12 18 15 15"></polyline>
          </svg>
          <span>导出记录 (.md)</span>
        </button>
        <button type="button" class="action-btn action-span2" onclick={handleExportWav} disabled={!take.blob}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>导出音频 (WAV)</span>
        </button>
      </div>
    </div>

    <MoodStampModal
      open={stampOpen}
      initialStamp={take.stamp}
      onsave={saveStamp}
      onclose={() => { stampOpen = false; }}
    />
  {/if}
</div>

<style>
  .ana-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty-wrap {
    text-align: center;
    padding: 32px 16px;
    color: var(--ink-3);
  }

  .take-meta-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--paper-card);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    box-shadow: var(--shadow);
  }

  .meta-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
  }

  .meta-left {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .meta-title {
    font-size: var(--fs-14);
    color: var(--ink-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta-time {
    font-size: var(--fs-11);
    color: var(--ink-3);
  }

  .meta-btns {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .meta-audio-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 6px;
    border-top: 1px solid var(--hairline);
  }

  .meta-seek-range {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    height: 6px;
    border-radius: 999px;
    background: linear-gradient(
      to right,
      var(--crayon-mint) 0%,
      var(--crayon-mint) var(--pct, 0%),
      var(--paper-groove) var(--pct, 0%),
      var(--paper-groove) 100%
    );
    outline: none;
    cursor: pointer;
    margin: 0;
  }
  .meta-seek-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--crayon-coral);
    border: 2px solid var(--paper-card);
    box-shadow: var(--shadow);
    cursor: pointer;
  }
  .meta-seek-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--crayon-coral);
    border: 2px solid var(--paper-card);
    box-shadow: var(--shadow);
    cursor: pointer;
  }

  .meta-audio-time {
    font-family: var(--font-data);
    font-size: var(--fs-11);
    color: var(--ink-3);
    flex-shrink: 0;
  }

  .mini-pill {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-1);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 6px 11px;
    border-radius: 999px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: transform 0.12s ease, background-color 0.16s ease;
  }
  .mini-pill.icon-only {
    padding: 6px 9px;
  }
  .mini-pill:active:not(:disabled) {
    transform: scale(0.95);
  }
  .mini-pill:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .mini-pill.pill-fav {
    background: var(--crayon-amber-soft);
    color: var(--crayon-amber-ink);
    border-color: var(--crayon-amber);
  }

  /* 体感印章展示卡（自然微浮凸手帐印泥章质感） */
  .stamp-seal-card {
    --seal-tone: var(--crayon-mint);
    --seal-tone-soft: var(--crayon-mint-soft);
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-soft);
    border: 1px solid color-mix(in srgb, var(--seal-tone) 34%, transparent);
    background: linear-gradient(135deg, var(--paper-card) 0%, var(--seal-tone-soft) 100%);
    color: var(--ink-1);
    cursor: pointer;
    box-shadow: inset 0 1px 0 var(--seal-highlight), var(--seal-shadow);
    transition: transform 0.12s ease, box-shadow 0.16s ease;
  }
  .stamp-seal-card:hover {
    transform: translateY(-1px);
  }
  .stamp-seal-card:active {
    transform: translateY(1px) scale(0.992);
  }
  .stamp-seal-card.tone-mint {
    --seal-tone: var(--crayon-mint);
    --seal-tone-soft: var(--crayon-mint-soft);
  }
  .stamp-seal-card.tone-sky {
    --seal-tone: var(--crayon-sky);
    --seal-tone-soft: var(--crayon-sky-soft);
  }
  .stamp-seal-card.tone-lavender {
    --seal-tone: var(--crayon-lavender);
    --seal-tone-soft: var(--crayon-lavender-soft);
  }
  .stamp-seal-card.tone-amber {
    --seal-tone: var(--crayon-amber);
    --seal-tone-soft: var(--crayon-amber-soft);
  }
  .stamp-seal-card.tone-indigo {
    --seal-tone: var(--crayon-indigo);
    --seal-tone-soft: var(--crayon-indigo-soft);
  }
  .stamp-seal-card.tone-coral {
    --seal-tone: var(--crayon-coral);
    --seal-tone-soft: var(--crayon-coral-soft);
  }
  .seal-emblem {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--seal-tone-soft);
    border: 1px solid var(--border-soft);
    border: 1px solid color-mix(in srgb, var(--seal-tone) 32%, transparent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-20);
    line-height: 1;
    flex-shrink: 0;
    transform: rotate(-4deg);
    box-shadow: inset 0 0 0 2.5px var(--paper-card), var(--shadow);
  }
  .seal-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .seal-head {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .seal-mood {
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-1);
  }
  .seal-tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .seal-tag {
    font-size: var(--fs-10);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--seal-tag-bg);
    color: var(--ink-2);
    border: 1px solid var(--hairline);
  }
  .seal-note {
    margin: 0;
    font-size: var(--fs-12);
    line-height: 1.45;
    color: var(--ink-2);
    word-break: break-word;
  }
  .seal-edit-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--fs-11);
    font-weight: 600;
    color: var(--ink-2);
    background: var(--seal-tag-bg);
    border: 1px solid var(--hairline);
    padding: 4px 8px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .summary-sheet-title.with-sub {
    margin-bottom: 4px;
  }
  .summary-sheet-sub {
    margin: 0 0 12px;
    font-size: var(--fs-12);
    line-height: 1.45;
    color: var(--ink-3);
  }

  .gentle-warn {
    padding: 9px 14px;
    border-radius: var(--radius-sm);
    background: var(--crayon-lavender-soft);
    color: var(--crayon-lavender-ink);
    font-size: var(--fs-12);
    line-height: 1.5;
  }

  /* 第 1 张卡：基频音高与声带状况 */
  .pitch-vocal-card {
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .zone-pill {
    font-size: var(--fs-11);
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
  }
  .pill-mint     { background: var(--crayon-mint-soft); color: var(--crayon-mint-ink); }
  .pill-lavender { background: var(--crayon-lavender-soft); color: var(--crayon-lavender-ink); }
  .pill-amber    { background: var(--crayon-amber-soft); color: var(--crayon-amber-ink); }
  .pill-sky      { background: var(--crayon-sky-soft); color: var(--crayon-sky-ink); }
  .pill-indigo   { background: var(--crayon-indigo-soft); color: var(--crayon-indigo-ink); }

  .pv-pitch-hero {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .pv-main-val {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .pv-hz {
    font-family: var(--font-data);
    font-size: var(--fs-24);
    font-weight: 700;
    color: var(--ink-1);
    line-height: 1.1;
  }
  .pv-note {
    font-size: var(--fs-13);
    font-weight: 600;
    color: var(--crayon-sky-ink);
    background: var(--crayon-sky-soft);
    padding: 2px 8px;
    border-radius: 999px;
  }
  .pv-sub-nums {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: var(--fs-12);
    color: var(--ink-3);
    flex-wrap: wrap;
  }

  .vf-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .vf-cell {
    background: var(--paper-3);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-sm);
    padding: 9px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .vf-cell.vf-hint {
    background: var(--crayon-lavender-soft);
    border-color: var(--crayon-lavender);
    border-color: color-mix(in srgb, var(--crayon-lavender) 48%, transparent);
  }
  .vf-lbl {
    font-size: var(--fs-10);
    color: var(--ink-3);
  }
  .vf-val {
    font-family: var(--font-data);
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-1);
  }
  .vf-sub {
    font-size: var(--fs-11);
    font-weight: 600;
    color: var(--ink-2);
  }
  .vf-cell.vf-hint .vf-sub {
    color: var(--crayon-lavender-ink);
  }
  .vf-muted .vf-val,
  .pv-main-val.vf-muted .pv-hz {
    opacity: 0.72;
  }
  .vf-muted .vf-sub {
    color: var(--ink-3);
    font-weight: 500;
  }
  .vf-guard-note {
    margin: 0;
    padding: 8px 11px;
    border-radius: var(--radius-xs);
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
    font-size: var(--fs-11);
    line-height: 1.5;
  }
  .pv-foot-note {
    margin: 0;
    font-size: var(--fs-12);
    color: var(--ink-2);
    line-height: 1.55;
  }

  .hero-card {
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .hero-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .vis-title-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .hero-card-title {
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-1);
  }
  .guard-pill {
    font-size: var(--fs-10);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
  }
  .hero-canvas-wrap {
    width: 100%;
    height: 226px;
  }
  .hero-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  .vis-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: var(--fs-11);
    color: var(--ink-3);
    line-height: 1.4;
  }
  .leg-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .leg-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--crayon-lavender);
    box-shadow: 0 0 0 3px var(--crayon-lavender-soft);
    flex-shrink: 0;
  }
  .leg-zone {
    width: 12px;
    height: 9px;
    border-radius: 3px;
    background: var(--crayon-mint-soft);
    border: 1px dashed var(--crayon-mint);
    flex-shrink: 0;
  }
  .vis-note {
    margin: 0;
    font-size: var(--fs-11);
    color: var(--ink-3);
    line-height: 1.5;
  }
  .stat-tok {
    display: inline-block;
    white-space: nowrap;
  }
  .empty-vis-inline {
    padding: 12px;
    border-radius: var(--radius-sm);
    background: var(--paper-3);
    font-size: var(--fs-13);
    color: var(--ink-2);
    line-height: 1.6;
  }

  .formant-strip {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .ft-cell {
    background: var(--paper-3);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .ft-cell.ft-hint {
    background: var(--crayon-lavender-soft);
    border-color: var(--crayon-lavender);
    border-color: color-mix(in srgb, var(--crayon-lavender) 48%, transparent);
  }
  .ft-lbl {
    font-size: var(--fs-10);
    color: var(--ink-3);
  }
  .ft-val {
    font-family: var(--font-data);
    font-size: var(--fs-14);
    font-weight: 700;
    color: var(--ink-1);
  }
  .ft-sub {
    font-size: var(--fs-11);
    color: var(--ink-2);
    font-weight: 600;
  }
  .ft-cell.ft-hint .ft-sub {
    color: var(--crayon-lavender-ink);
  }

  .mismatch-callout {
    background: var(--crayon-coral-soft);
    border: 1px solid var(--crayon-coral);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .mismatch-title {
    font-size: var(--fs-12);
    font-weight: 700;
    color: var(--crayon-coral-ink);
  }
  .mismatch-text {
    margin: 0;
    font-size: var(--fs-12);
    line-height: 1.55;
    color: var(--ink-1);
  }

  .pitch-zone-box {
    background: var(--paper-3);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    border: 1px solid var(--hairline);
  }
  .pz-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .pz-title {
    font-size: var(--fs-12);
    color: var(--ink-2);
    font-weight: 600;
  }
  .pz-val {
    font-size: var(--fs-13);
    font-weight: 700;
    color: var(--ink-1);
  }
  .pz-track {
    position: relative;
    height: 10px;
    border-radius: 999px;
    display: flex;
    overflow: visible;
    background: var(--paper-groove);
  }
  .pz-seg {
    height: 100%;
  }
  .seg-low {
    width: 29%;
    background: var(--crayon-indigo-soft);
    border-radius: 999px 0 0 999px;
  }
  .seg-mid {
    width: 15%;
    background: var(--crayon-lavender-soft);
  }
  .seg-high {
    width: 56%;
    background: var(--crayon-mint-soft);
    border-radius: 0 999px 999px 0;
  }
  .pz-floor-tick {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    transform: translateX(-50%);
    background: var(--crayon-mint);
    border-radius: 999px;
  }
  .pz-dot {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--crayon-coral);
    border: 2px solid var(--paper-card);
    box-shadow: var(--shadow);
  }
  .pz-labels {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-10);
    color: var(--ink-3);
    margin-top: 6px;
  }

  /* 第 3 张独立小卡：咝音重心 */
  .sib-card {
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sib-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .sib-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .sib-badge {
    font-size: var(--fs-11);
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--crayon-lavender-soft);
    color: var(--crayon-lavender-ink);
  }
  .sib-badge.badge-sage {
    background: var(--crayon-mint-soft);
    color: var(--crayon-mint-ink);
  }
  .sib-badge.badge-rose {
    background: var(--crayon-coral-soft);
    color: var(--crayon-coral-ink);
  }
  .sib-val {
    font-family: var(--font-data);
    font-size: var(--fs-16);
    font-weight: 700;
    color: var(--ink-1);
  }
  .sib-ruler {
    background: var(--paper-3);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
  }
  .sib-track {
    position: relative;
    height: 10px;
    border-radius: 999px;
    background: var(--paper-groove);
    overflow: visible;
  }
  .sib-target-band {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 33.3%;
    width: 41.7%;
    border-radius: 999px;
    background: var(--crayon-mint-soft);
  }
  .sib-dot {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--crayon-lavender);
    border: 2px solid var(--paper-card);
    box-shadow: var(--shadow);
  }
  .sib-dot.dot-sage {
    background: var(--crayon-mint);
  }
  .sib-dot.dot-rose {
    background: var(--crayon-coral);
  }
  .sib-labels {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-10);
    color: var(--ink-3);
    margin-top: 6px;
  }
  .sib-tip {
    margin: 0;
    font-size: var(--fs-12);
    color: var(--ink-2);
    line-height: 1.55;
  }

  .drawer-sheet {
    margin-bottom: 14px;
  }
  .actions-card {
    margin-bottom: 0;
  }
  .action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .action-btn {
    border: 1px solid var(--border-soft);
    background: var(--paper-3);
    color: var(--ink-1);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 11px 10px;
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: transform 0.12s ease;
  }
  .action-btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .action-btn.btn-primary-soft {
    grid-column: 1 / -1;
    background: var(--btn-primary-bg);
    color: var(--rose-on);
    border-color: var(--btn-primary-border);
    font-size: var(--fs-14);
    padding: 13px 14px;
  }
  .action-btn.action-span2 {
    grid-column: 1 / -1;
  }
  .action-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .deep-drawer {
    padding: 0;
  }
  .drawer-toggle {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    cursor: pointer;
    font-size: var(--fs-13);
    font-weight: 600;
    color: var(--ink-2);
    padding: 4px 0;
  }
  .drawer-arrow {
    font-size: var(--fs-11);
    color: var(--crayon-sky-ink);
    background: var(--crayon-sky-soft);
    padding: 3px 9px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .drawer-chev {
    transition: transform 0.2s ease;
  }
  .drawer-chev.open {
    transform: rotate(180deg);
  }
  .drawer-body {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mini-chart-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mini-chart-title {
    font-size: var(--fs-12);
    font-weight: 600;
    color: var(--ink-2);
  }
  .detail-canvas {
    width: 100%;
    height: 156px;
    display: block;
  }
  .detail-canvas.vowel-canvas {
    height: 188px;
  }
  .mini-chart-sub {
    font-size: var(--fs-11);
    color: var(--ink-3);
    line-height: 1.45;
  }

  .metrics-groups {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .metrics-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mg-head {
    font-size: var(--fs-11);
    font-weight: 700;
    color: var(--ink-3);
    padding-left: 4px;
  }
  .metrics-table {
    background: var(--paper-3);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .m-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    gap: 10px;
    font-size: var(--fs-12);
    color: var(--ink-2);
    border-bottom: 1px dashed var(--hairline);
    padding-bottom: 5px;
  }
  .m-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .m-row strong {
    color: var(--ink-1);
    text-align: right;
  }

  .del-take-btn {
    border: none;
    background: var(--crayon-coral-soft);
    color: var(--danger-ink);
    font-size: var(--fs-12);
    font-weight: 600;
    padding: 9px 14px;
    border-radius: 999px;
    cursor: pointer;
    align-self: center;
  }

  .sr-hidden {
    display: none;
  }
</style>
