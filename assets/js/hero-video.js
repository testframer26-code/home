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
   */

  var hero = document.querySelector("[data-hero]");
  if (!hero) return;

  var sticky = hero.querySelector(".hero__sticky");
  var video = hero.querySelector(".hero__video");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!video || !sticky || reduceMotion.matches) return;

  var desktopSource = video.getAttribute("data-src-desktop");
  var mobileSource = video.getAttribute("data-src-mobile");
  var source = window.matchMedia("(max-width: 719px)").matches ? mobileSource : desktopSource;
  if (!source) return;

  var SMOOTHING = 0.38;
  var MIN_SEEK_DELTA = 1 / 48;
  var SETTLED_DELTA = 0.002;

  var duration = 0;
  var targetTime = 0;
  var renderedTime = 0;
  var lastSeek = -1;
  var rafId = 0;
  var ready = false;
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

  function reveal() {
    if (ready) return;
    if (!isFinite(video.duration) || video.duration <= 0) return;

    duration = video.duration;
    ready = true;
    video.pause();
    measure();
    renderedTime = targetTime;
    lastSeek = -1;
    hero.classList.add("is-ready");
    schedule();
  }

  function fallback() {
    ready = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    hero.classList.remove("is-enhanced", "is-ready");
    hero.classList.add("is-unavailable");
    window.removeEventListener("scroll", updateTarget);
    window.removeEventListener("resize", measure);
    window.removeEventListener("orientationchange", measure);
  }

  video.autoplay = false;
  video.loop = false;
  video.muted = true;
  video.src = source;
  video.preload = "auto";
  video.addEventListener("play", function () {
    video.pause();
  });
  video.addEventListener("loadeddata", reveal);
  video.addEventListener("canplay", reveal);
  video.addEventListener("error", fallback);

  window.addEventListener("scroll", updateTarget, { passive: true });
  window.addEventListener("resize", measure);
  window.addEventListener("orientationchange", measure);

  hero.classList.add("is-enhanced");
  measure();
  video.load();
})();
