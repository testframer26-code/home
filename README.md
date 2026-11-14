# Leon Home

A luxury real estate landing page built as static HTML, CSS and JavaScript, served from the repository root.

## Preview

The Base44 environment serves this checkout on port 3000 with a standard-library static server; files are read from disk on every request, so edits appear on refresh. The server supports HTTP byte ranges so the hero film can be scrubbed without waiting for a full download.

## Hero film

The hero is a pinned, 320vh scroll section whose progress is mapped to the film's timeline. The video is never played or looped: a single `requestAnimationFrame` loop eases `video.currentTime` towards the scroll target, and a `prefers-reduced-motion` visitor gets the still image instead. `assets/js/hero-video.js` owns the interaction.

`assets/video/hero.mp4` (1164×776) and `assets/video/hero-mobile.mp4` (900×600) are H.264 High, `yuv420p`, no audio, fast-start metadata, and encoded with a keyframe every 4 frames. The dense GOP is what keeps random seeks fast. Do not replace them with a long-GOP export or move the films to a server without byte-range support, or scrubbing will stutter.

## End-to-end tests

Playwright covers the footer's desktop layout and mobile accordions, plus the hero film: no autoplay, forward and reverse scroll mapping, exact endpoints, pinned layout, mobile source selection and touch scrubbing, reduced-motion fallback, and video-load failure. The suite targets a server at `http://localhost:3000`. With the preview stack running:

```sh
docker run --rm --network host -e CI=1 \
  -v "$PWD":/work \
  -v leon-home-node-modules:/work/node_modules \
  -w /work mcr.microsoft.com/playwright:v1.65.1-noble \
  sh -ec "npm install --no-audit --no-fund && npx playwright test"
```

Point the suite at another deployment with `-e BASE_URL=https://example.com` (and drop `--network host` for a remote host). Configuration lives in `playwright.config.js`; specs live in `tests/`.
