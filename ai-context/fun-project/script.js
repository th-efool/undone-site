const els = {
  form: document.querySelector('#lessonForm'),
  url: document.querySelector('#youtubeUrl'),
  start: document.querySelector('#startTime'),
  end: document.querySelector('#endTime'),
  msg: document.querySelector('#message'),
  title: document.querySelector('#lessonTitle'),
  current: document.querySelector('#currentLessonTime'),
  total: document.querySelector('#totalLessonTime'),
  remaining: document.querySelector('#remainingTime'),
  actual: document.querySelector('#actualTimestamp'),
  timeline: document.querySelector('#timeline'),
  timelineEnd: document.querySelector('#timelineEnd'),
  shell: document.querySelector('#playerShell'),
  overlay: document.querySelector('#playerOverlay'),
  playPause: document.querySelector('#playPause'),
  centerPlayPause: document.querySelector('#centerPlayPause'),
  back10: document.querySelector('#back10'),
  forward10: document.querySelector('#forward10'),
  playerMount: document.querySelector('#player'),
};

let player;
let playerReady = false;
let playerReadyResolver;
let playerReadyPromise;
let lessonStart = 0;
let lessonEnd = 0;
let lessonDuration = 0;
let syncTimer;
let apiTimer;
let apiReady = Boolean(window.YT?.Player);
let apiLoading = false;
let apiPromise;
let apiResolver;
let pendingLesson;
let playing = false;
let playerActivated = false;
let draggingTimeline = false;
let controlsHideTimer;

window.onYouTubeIframeAPIReady = markApiReady;

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadLesson(undefined, { autoplay: true });
});
els.timeline.addEventListener('keydown', onTimelineKeydown);
els.timeline.addEventListener('pointerdown', startTimelineDrag);
els.playPause.addEventListener('click', onControlToggle);
els.centerPlayPause.addEventListener('click', onControlToggle);
els.back10.addEventListener('click', rewindTenSeconds);
els.forward10.addEventListener('click', forwardTenSeconds);
els.shell.addEventListener('click', togglePlayback);
els.shell.addEventListener('pointermove', showControlsTemporarily);
els.shell.addEventListener('pointerleave', scheduleControlsHide);
els.overlay.addEventListener('click', (event) => {
  if (event.target.closest('button, .timeline-control')) event.stopPropagation();
});

function parseYouTubeId(url) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id = '';
    if (host === 'youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = parsed.searchParams.get('v') || '';
      const match = parsed.pathname.match(/^\/(embed|shorts)\/([^/?#]+)/);
      if (!id && match) id = match[2];
    }
    return /^[\w-]{6,}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}

function timeStringToSeconds(value) {
  const parts = value.split(':').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return NaN;
  const [hours, minutes, seconds] = parts;
  if (minutes > 59 || seconds > 59) return NaN;
  return hours * 3600 + minutes * 60 + seconds;
}

function secondsToDisplay(seconds, showHours = false) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (showHours || hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function initYouTubeApi() {
  if (window.YT?.Player) {
    markApiReady();
    return apiPromise || Promise.resolve();
  }
  if (!apiPromise) apiPromise = new Promise((resolve) => { apiResolver = resolve; });
  if (apiLoading) return apiPromise;

  apiLoading = true;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.async = true;
  tag.onerror = () => {
    apiLoading = false;
    setMessage('YouTube API failed to load. Check network or content blockers.');
  };
  document.head.append(tag);
  return apiPromise;
}

function markApiReady() {
  clearTimeout(apiTimer);
  apiReady = true;
  apiLoading = false;
  setMessage('');
  apiResolver?.();
  if (pendingLesson) {
    const { data, options } = pendingLesson;
    pendingLesson = null;
    loadLesson(data, options);
  }
}

function waitForApi(data, options = {}) {
  pendingLesson = { data, options };
  initYouTubeApi();
  if (apiReady) return;
  setMessage('Loading YouTube API...');
  clearTimeout(apiTimer);
  apiTimer = setTimeout(() => {
    if (!apiReady) setMessage('Still loading YouTube API. Check network/content blocker, then retry.');
  }, 8000);
}

async function loadLesson(config, options = {}) {
  const data = config || getLessonConfig();
  if (!data) return;
  if (!apiReady) return waitForApi(data, options);
  if (!els.playerMount) return setMessage('Player container missing.');

  pendingLesson = null;
  ({ lessonStart, lessonEnd, lessonDuration } = data);
  updateLessonUi(data.videoId);

  await ensurePlayer();
  loadVideo(data.videoId, Boolean(options.autoplay));
  activatePlayer();
  startSyncLoop();
}

function ensurePlayer() {
  if (playerReady) return Promise.resolve();
  if (playerReadyPromise) return playerReadyPromise;

  playerReadyPromise = new Promise((resolve) => { playerReadyResolver = resolve; });
  const frame = createYouTubeFrame();
  player = new YT.Player(frame, {
    playerVars: {
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      playsinline: 1,
      ...(getYouTubePlayerOrigin() ? { origin: getYouTubePlayerOrigin() } : {}),
    },
    events: {
      onReady: () => {
        hardenYouTubeFrame();
        playerReady = true;
        activatePlayer();
        playerReadyResolver();
      },
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
  return playerReadyPromise;
}

function createYouTubeFrame() {
  els.playerMount.textContent = '';
  const frame = document.createElement('iframe');
  frame.id = 'youtubePlayer';
  frame.title = 'YouTube lesson player';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  frame.allowFullscreen = true;
  frame.src = getInitialYouTubeEmbedUrl();
  els.playerMount.append(frame);
  return frame;
}

function getInitialYouTubeEmbedUrl() {
  const params = new URLSearchParams({ enablejsapi: '1', playsinline: '1' });
  const origin = getYouTubePlayerOrigin();
  if (origin) params.set('origin', origin);
  return `https://www.youtube.com/embed?${params}`;
}

function hardenYouTubeFrame() {
  const frame = els.playerMount.querySelector('iframe');
  if (!frame) return;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  frame.allowFullscreen = true;
}

function onPlayerError(event) {
  const code = event?.data;
  if (code === 153) {
    setMessage('Video blocked by missing referrer. Serve this page over http(s), not file://.');
    return;
  }
  setMessage('Video failed to load. Check URL, embedding permissions, or network.');
}

function loadVideo(videoId, autoplay) {
  hardenYouTubeFrame();
  const args = { videoId, startSeconds: lessonStart, endSeconds: lessonEnd };
  if (autoplay) player.loadVideoById(args);
  else player.cueVideoById(args);
  player.seekTo(lessonStart, true);
  updatePlayerUI(0);
  if (autoplay) player.playVideo();
}

function getLessonConfig() {
  const videoId = parseYouTubeId(els.url.value);
  const start = timeStringToSeconds(els.start.value);
  const end = timeStringToSeconds(els.end.value);
  if (!videoId) return setMessage('Enter a valid YouTube URL.');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return setMessage('Use HH:MM:SS time format.');
  if (end <= start) return setMessage('End time must be after start time.');
  setMessage('');
  return { videoId, lessonStart: start, lessonEnd: end, lessonDuration: end - start };
}

function updateLessonUi(videoId) {
  playerActivated = false;
  playing = false;
  els.shell.classList.add('is-uninitialized');
  els.shell.classList.remove('is-playing');
  els.title.textContent = `Focused lesson · ${videoId}`;
  els.total.textContent = secondsToDisplay(lessonDuration);
  els.timelineEnd.textContent = secondsToDisplay(lessonDuration);
  setCustomControlsEnabled(false);
  updatePlayPauseControl();
  updatePlayerUI(0);
}

function onPlayerStateChange(event) {
  const state = event.data;
  playing = state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
  if (state === YT.PlayerState.ENDED) {
    pauseAtLessonEnd();
    return;
  }
  if (playerReady && !playerActivated) activatePlayer();
  updatePlayPauseControl();
  updateControlsVisibility();
  startSyncLoop();
}

function onControlToggle(event) {
  event.stopPropagation();
  togglePlayback();
}

function togglePlayback() {
  if (!playerReady) return;
  if (playing) {
    pauseLesson();
    return;
  }
  playLesson();
}

function playLesson() {
  if (!playerReady) return;
  const virtualTime = getVirtualTime();
  seekVirtualTime(virtualTime >= lessonDuration ? 0 : virtualTime);
  player.playVideo();
}

function pauseLesson() {
  if (!playerReady) return;
  player.pauseVideo();
}

function rewindTenSeconds() {
  seekVirtualTime(getVirtualTime() - 10, playing);
}

function forwardTenSeconds() {
  seekVirtualTime(getVirtualTime() + 10, playing);
}

function seekVirtualTime(virtualTime, resume = false) {
  if (!playerReady) return;
  const clampedVirtualTime = getClampedVirtualTime(virtualTime);
  const actualTime = clampToLessonBounds(lessonStart + clampedVirtualTime);
  player.seekTo(actualTime, true);
  updatePlayerUI(clampedVirtualTime);
  if (clampedVirtualTime >= lessonDuration) {
    pauseAtLessonEnd();
    return;
  }
  if (resume) player.playVideo();
}

function clampToLessonBounds(actualTime) {
  return clamp(actualTime, lessonStart, lessonEnd);
}

function getClampedVirtualTime(virtualTime) {
  return clamp(virtualTime, 0, lessonDuration);
}

function startSyncLoop() {
  if (!playerReady) return;
  clearInterval(syncTimer);
  syncTimeline();
  syncTimer = setInterval(syncTimeline, 200);
}

function syncTimeline(forcedVirtualTime) {
  if (!playerReady || !player.getCurrentTime) return;
  const currentTime = player.getCurrentTime();
  const clampedActualTime = clampToLessonBounds(currentTime);

  if (currentTime < lessonStart) {
    player.seekTo(lessonStart, true);
    updatePlayerUI(0);
    return;
  }

  if (currentTime >= lessonEnd) {
    pauseAtLessonEnd();
    return;
  }

  const virtualTime = Number.isFinite(forcedVirtualTime)
    ? getClampedVirtualTime(forcedVirtualTime)
    : getClampedVirtualTime(clampedActualTime - lessonStart);
  updatePlayerUI(virtualTime);
}

function updatePlayerUI(virtualTime) {
  const clampedVirtualTime = getClampedVirtualTime(virtualTime);
  const progress = lessonDuration ? clamp((clampedVirtualTime / lessonDuration) * 100, 0, 100) : 0;
  els.current.textContent = secondsToDisplay(clampedVirtualTime);
  els.total.textContent = secondsToDisplay(lessonDuration);
  updateRemainingTime(clampedVirtualTime);
  els.actual.textContent = secondsToDisplay(lessonStart + clampedVirtualTime, true);
  els.timeline.style.setProperty('--timeline-progress', `${progress}%`);
  els.timeline.setAttribute('aria-valuemax', String(Math.floor(lessonDuration)));
  els.timeline.setAttribute('aria-valuenow', String(Math.floor(clampedVirtualTime)));
  els.timeline.setAttribute('aria-valuetext', `${secondsToDisplay(clampedVirtualTime)} of ${secondsToDisplay(lessonDuration)}`);
}

function updateRemainingTime(virtualTime) {
  const remaining = clamp(lessonDuration - virtualTime, 0, lessonDuration);
  els.remaining.textContent = `${secondsToDisplay(remaining)} remaining`;
}

function pauseAtLessonEnd() {
  if (!playerReady) return;
  player.pauseVideo();
  player.seekTo(lessonEnd, true);
  playing = false;
  updatePlayerUI(lessonDuration);
  updatePlayPauseControl();
  updateControlsVisibility();
}

function updatePlayPauseControl() {
  [els.playPause, els.centerPlayPause].forEach((button) => {
    button.dataset.state = playing ? 'playing' : 'paused';
    button.setAttribute('aria-label', playing ? 'Pause lesson' : 'Play lesson');
  });
}

function updateControlsVisibility() {
  els.shell.classList.toggle('is-playing', playing);
  if (playing) scheduleControlsHide();
  else showControls();
}

function showControls() {
  clearTimeout(controlsHideTimer);
  els.shell.classList.remove('is-idle');
}

function showControlsTemporarily() {
  showControls();
  if (playing) scheduleControlsHide();
}

function scheduleControlsHide() {
  clearTimeout(controlsHideTimer);
  if (!playing || draggingTimeline) return;
  controlsHideTimer = setTimeout(() => {
    if (playing && !draggingTimeline) els.shell.classList.add('is-idle');
  }, 2500);
}

function getVirtualTime() {
  if (!playerReady || !player.getCurrentTime) return 0;
  return getClampedVirtualTime(player.getCurrentTime() - lessonStart);
}

function activatePlayer() {
  playerActivated = true;
  els.shell.classList.remove('is-uninitialized');
  setCustomControlsEnabled(true);
}

function setCustomControlsEnabled(enabled) {
  setTimelineEnabled(enabled);
  [els.playPause, els.centerPlayPause, els.back10, els.forward10].forEach((btn) => { btn.disabled = !enabled; });
}

function setTimelineEnabled(enabled) {
  els.timeline.classList.toggle('is-disabled', !enabled);
  els.timeline.tabIndex = enabled ? 0 : -1;
  els.timeline.setAttribute('aria-disabled', String(!enabled));
}

function onTimelineKeydown(event) {
  if (els.timeline.getAttribute('aria-disabled') === 'true') return;

  const keySeekMap = {
    ArrowLeft: -5,
    ArrowDown: -5,
    ArrowRight: 5,
    ArrowUp: 5,
  };

  if (event.key === 'Home') {
    event.preventDefault();
    seekVirtualTime(0, playing);
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    seekVirtualTime(lessonDuration, playing);
    return;
  }

  if (Object.prototype.hasOwnProperty.call(keySeekMap, event.key)) {
    event.preventDefault();
    seekVirtualTime(getVirtualTime() + keySeekMap[event.key], playing);
  }
}

function startTimelineDrag(event) {
  if (els.timeline.getAttribute('aria-disabled') === 'true') return;
  event.preventDefault();
  showControls();
  draggingTimeline = true;
  els.timeline.classList.add('is-dragging');
  els.timeline.setPointerCapture(event.pointerId);
  seekTimelineFromPointer(event, false);
  els.timeline.addEventListener('pointermove', dragTimeline);
  els.timeline.addEventListener('pointerup', stopTimelineDrag);
  els.timeline.addEventListener('pointercancel', stopTimelineDrag);
}

function dragTimeline(event) {
  if (!draggingTimeline) return;
  seekTimelineFromPointer(event, false);
}

function stopTimelineDrag(event) {
  if (!draggingTimeline) return;
  seekTimelineFromPointer(event, playing);
  draggingTimeline = false;
  els.timeline.classList.remove('is-dragging');
  if (els.timeline.hasPointerCapture(event.pointerId)) {
    els.timeline.releasePointerCapture(event.pointerId);
  }
  els.timeline.removeEventListener('pointermove', dragTimeline);
  els.timeline.removeEventListener('pointerup', stopTimelineDrag);
  els.timeline.removeEventListener('pointercancel', stopTimelineDrag);
  if (playing) scheduleControlsHide();
}

function seekTimelineFromPointer(event, resume) {
  const bounds = els.timeline.getBoundingClientRect();
  const ratio = bounds.width ? clamp((event.clientX - bounds.left) / bounds.width, 0, 1) : 0;
  seekVirtualTime(ratio * lessonDuration, resume);
}

function setMessage(text) {
  els.msg.textContent = text;
  return null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getYouTubePlayerOrigin() {
  return window.location.origin.startsWith('http') ? window.location.origin : '';
}
