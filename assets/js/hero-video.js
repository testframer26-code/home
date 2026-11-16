(function () {
  "use strict";

  /*
   * Scroll-scrubbed hero film.
   *
   * The hero section provides a 320vh runway while its inner viewport stays
   * pinned. Scroll only updates a target time; a single rAF loop eases the
   * rendered time towards it and writes video.currentTime. The video is never
   * played: no autoplay, no loop, no play() call.
   *
   * The MP4s are encoded with a keyframe every 4 frames, H.264 High, yuv420p,
   * fast-start metadata and no audio. Dense keyframes make random seeks cheap;
   * H.264 is preferred over WebM here because hardware decoding gives the most
   * consistent seek latency. Re-encoding with a long GOP will make scrubbing
   * stutter.
   *
   * The film is the heaviest asset on the page, so it stays off the critical
   * path: no video bytes are requested while the page paints. The still image
   * holds the hero until the visitor shows intent (pointer, touch, wheel or
   * scroll) or the hero has been on screen for a moment, whichever comes first.
   * The cut matching the current viewport is requested, and re-chosen when the
   * breakpoint changes (rotation, resizing the preview). Data-saver visitors
   * keep the still image.
   */

  var hero = document.querySelector("[data-hero]");
  if (!hero) return;

  var sticky = hero.querySelector(".hero__sticky");
  var video = hero.querySelector(".hero__video");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!video || !sticky || reduceMotion.matches) return;

  var desktopSource = video.getAttribute("data-src-desktop");
  var mobileSource = video.getAttribute("data-src-mobile");
  if (!desktopSource || !mobileSource) return;

  var connection = navigator.connection;
  if (connection && connection.saveData) {
    hero.classList.add("is-unavailable");
    return;
  }

  var mobileQuery = window.matchMedia("(max-width: 719px)");

  var SMOOTHING = 0.38;
  var MIN_SEEK_DELTA = 1 / 48;
  var SETTLED_DELTA = 0.002;
  var LOAD_TIMEOUT = 12000;
  var PRELOAD_DELAY = 1500;

  var duration = 0;
  var targetTime = 0;
  var renderedTime = 0;
  var lastSeek = -1;
  var rafId = 0;
  var ready = false;
  var failed = false;
  var enabled = false;
  var preloadTimer = 0;
  var currentSource = "";
  var loadTimer = 0;
  var sectionTop = 0;
  var scrollRange = 1;

  function clampTime(time) {
    return Math.min(Math.max(time, 0), Math.max(duration - 0.001, 0));
  }

  function schedule() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    rafId = 0;
    if (!ready) return;

    var diff = targetTime - renderedTime;
    var settled = Math.abs(diff) < SETTLED_DELTA;
    renderedTime = settled ? targetTime : renderedTime + diff * SMOOTHING;

    if (settled || Math.abs(renderedTime - lastSeek) >= MIN_SEEK_DELTA) {
      var next = clampTime(renderedTime);
      if (next !== lastSeek) {
        video.currentTime = next;
        lastSeek = next;
      }
    }

    if (!settled) schedule();
  }

  function updateTarget() {
    if (!ready) return;
    var progress = (window.scrollY - sectionTop) / scrollRange;
    progress = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    targetTime = progress * duration;
    schedule();
  }

  function measure() {
    var rect = hero.getBoundingClientRect();
    sectionTop = rect.top + window.scrollY;
    scrollRange = Math.max(1, hero.offsetHeight - sticky.offsetHeight);
    updateTarget();
  }

  function prime() {
    if (ready || failed) return;
    if (!isFinite(video.duration) || video.duration <= 0) return;

    duration = video.duration;
    measure();
    /* Ask the decoder for a frame straight away. Revealing the film before a
       frame exists would show an empty black box over the still image. */
    video.currentTime = Math.min(0.001, duration / 2);
  }

  function reveal() {
    if (ready || failed) return;
    if (!isFinite(video.duration) || video.duration <= 0) return;

    duration = video.duration;
    ready = true;
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = 0;
    }
    video.pause();
    measure();
    renderedTime = targetTime;
    lastSeek = -1;
    hero.classList.remove("is-loading");
    hero.classList.add("is-ready");
    schedule();
  }

  function fallback() {
    failed = true;
    ready = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = 0;
    }
    if (preloadTimer) {
      clearTimeout(preloadTimer);
      preloadTimer = 0;
    }
    hero.classList.remove("is-enhanced", "is-loading", "is-ready");
    hero.classList.add("is-unavailable");
    window.removeEventListener("scroll", updateTarget);
    window.removeEventListener("scroll", enableFilm);
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("orientationchange", onViewportChange);
    window.removeEventListener("pointerdown", enableFilm);
    window.removeEventListener("touchstart", enableFilm);
    window.removeEventListener("wheel", enableFilm);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", onViewportChange);
    }
    if (mobileQuery.removeEventListener) {
      mobileQuery.removeEventListener("change", onViewportChange);
    } else if (mobileQuery.removeListener) {
      mobileQuery.removeListener(onViewportChange);
    }
  }

  /* Load the cut that matches the current viewport, swapping only when the
     breakpoint actually changed. */
  function beginLoad() {
    if (failed) return;

    var next = mobileQuery.matches ? mobileSource : desktopSource;
    if (next === currentSource) return;
    currentSource = next;

    ready = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    duration = 0;
    targetTime = 0;
    renderedTime = 0;
    lastSeek = -1;

    hero.classList.remove("is-ready");
    hero.classList.add("is-enhanced", "is-loading");

    video.preload = "auto";
    video.src = next;
    video.load();

    if (loadTimer) clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      loadTimer = 0;
      if (!ready) fallback();
    }, LOAD_TIMEOUT);
  }

  /* Nothing is fetched until the film is actually wanted. */
  function enableFilm() {
    if (enabled || failed) return;
    enabled = true;
    if (preloadTimer) {
      clearTimeout(preloadTimer);
      preloadTimer = 0;
    }
    beginLoad();
  }

  function heroIsVisible() {
    var rect = hero.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function scheduleFilm() {
    if (enabled || failed || preloadTimer) return;
    preloadTimer = setTimeout(function () {
      preloadTimer = 0;
      if (heroIsVisible()) enableFilm();
    }, PRELOAD_DELAY);
  }

  function onViewportChange() {
    if (failed) return;
    if (enabled) beginLoad();
    measure();
  }

  video.autoplay = false;
  video.loop = false;
  video.muted = true;
  video.addEventListener("loadedmetadata", prime);
  video.addEventListener("loadeddata", reveal);
  video.addEventListener("canplay", reveal);
  video.addEventListener("seeked", reveal);
  video.addEventListener("error", fallback);
  video.addEventListener("play", function () {
    video.pause();
  });

  window.addEventListener("scroll", updateTarget, { passive: true });
  window.addEventListener("scroll", enableFilm, { passive: true });
  window.addEventListener("pointerdown", enableFilm, { passive: true });
  window.addEventListener("touchstart", enableFilm, { passive: true });
  window.addEventListener("wheel", enableFilm, { passive: true });
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("orientationchange", onViewportChange);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onViewportChange);
  }
  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener("change", onViewportChange);
  } else if (mobileQuery.addListener) {
    mobileQuery.addListener(onViewportChange);
  }

  hero.classList.add("is-enhanced");
  measure();
  scheduleFilm();
})();
