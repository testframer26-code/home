const { test, expect } = require("@playwright/test");

const HERO = "[data-hero]";
const VIDEO = ".hero__video";

async function openHero(page) {
  await page.goto("/");
  await expect(page.locator(HERO)).toHaveClass(/is-ready/, { timeout: 15000 });
  await expect(page.locator(VIDEO)).toHaveJSProperty("paused", true);
  await page.evaluate(() => document.fonts.ready);
}

async function metrics(page) {
  return page.evaluate(() => {
    const hero = document.querySelector("[data-hero]");
    const sticky = hero.querySelector(".hero__sticky");
    const video = hero.querySelector(".hero__video");
    const image = hero.querySelector(".hero__img");
    const header = document.querySelector(".site-header");
    return {
      viewportHeight: window.innerHeight,
      sectionTop: Math.round(hero.getBoundingClientRect().top + window.scrollY),
      sectionHeight: hero.offsetHeight,
      stickyHeight: sticky.offsetHeight,
      stickyTop: Math.round(sticky.getBoundingClientRect().top),
      heroTop: Math.round(hero.getBoundingClientRect().top),
      nextTop: Math.round(document.querySelector("#about").getBoundingClientRect().top),
      duration: video.duration,
      currentTime: video.currentTime,
      paused: video.paused,
      autoplay: video.autoplay,
      loop: video.loop,
      currentSrc: video.currentSrc,
      videoVisible: getComputedStyle(video).display !== "none" && getComputedStyle(video).opacity !== "0",
      imageVisible: getComputedStyle(image).display !== "none" && getComputedStyle(image).visibility !== "hidden",
      headerHeight: header.offsetHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function scrollToProgress(page, progress) {
  await page.evaluate((value) => {
    const hero = document.querySelector("[data-hero]");
    const sticky = hero.querySelector(".hero__sticky");
    const top = hero.getBoundingClientRect().top + window.scrollY;
    const range = hero.offsetHeight - sticky.offsetHeight;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ top: top + range * value, behavior: "instant" });
  }, progress);
}

async function waitForTime(page, expected, timeout = 8000) {
  await page.waitForFunction(
    (target) => {
      const video = document.querySelector(".hero__video");
      return Math.abs(video.currentTime - target) <= 0.04;
    },
    expected,
    { timeout }
  );
}

test.describe("Hero film — desktop scrub", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });

  test("stays paused and maps scroll to the timeline in both directions", async ({ page }) => {
    await openHero(page);
    const start = await metrics(page);
    expect(start.autoplay).toBe(false);
    expect(start.loop).toBe(false);
    expect(start.paused).toBe(true);
    expect(start.currentTime).toBeLessThan(0.01);

    await page.waitForTimeout(800);
    expect((await metrics(page)).currentTime).toBeLessThan(0.01);
    expect((await metrics(page)).paused).toBe(true);

    let previous = -1;
    for (const progress of [0.25, 0.5, 0.75]) {
      await scrollToProgress(page, progress);
      await waitForTime(page, start.duration * progress);
      const state = await metrics(page);
      expect(Math.abs(state.currentTime - start.duration * progress)).toBeLessThan(0.09);
      expect(state.currentTime).toBeGreaterThan(previous);
      expect(state.paused).toBe(true);
      previous = state.currentTime;

      if (progress === 0.5) {
        expect(state.heroTop).toBeLessThan(0);
        expect(state.stickyTop).toBe(0);
      }
    }

    await scrollToProgress(page, 1);
    await waitForTime(page, start.duration - 0.001);
    const end = await metrics(page);
    expect(end.currentTime).toBeGreaterThan(start.duration - 0.04);
    expect(end.paused).toBe(true);
    expect(end.nextTop).toBeGreaterThanOrEqual(end.viewportHeight - 2);
    expect(end.nextTop).toBeLessThanOrEqual(end.viewportHeight + 4);

    await scrollToProgress(page, 0.2);
    await waitForTime(page, start.duration * 0.2);
    const back = await metrics(page);
    expect(back.currentTime).toBeLessThan(end.currentTime);
    expect(back.currentTime).toBeLessThan(start.duration * 0.5);
    expect(back.paused).toBe(true);

    await scrollToProgress(page, 0);
    await waitForTime(page, 0);
    expect((await metrics(page)).currentTime).toBeLessThan(0.08);
  });

  test("pins the full viewport and keeps the hero content unobstructed", async ({ page }) => {
    await openHero(page);
    const state = await metrics(page);
    expect(state.sectionHeight).toBeGreaterThan(state.viewportHeight * 2.5);
    expect(state.sectionHeight).toBeLessThanOrEqual(state.viewportHeight * 3.4);
    expect(Math.abs(state.stickyHeight - state.viewportHeight)).toBeLessThanOrEqual(2);
    expect(state.overflow).toBeLessThanOrEqual(1);

    const boxes = await page.evaluate(() => {
      const rect = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
      };
      return {
        eyebrow: rect(".hero__eyebrow"),
        footer: rect(".hero__footer"),
        title: rect(".hero__title"),
        header: rect(".site-header"),
      };
    });

    expect(boxes.eyebrow.top).toBeGreaterThanOrEqual(boxes.header.bottom + 10);
    expect(boxes.title.top).toBeGreaterThan(boxes.eyebrow.bottom);
    expect(boxes.footer.bottom).toBeLessThanOrEqual(state.viewportHeight + 1);
    expect(boxes.title.left).toBeGreaterThanOrEqual(0);
    expect(boxes.title.right).toBeLessThanOrEqual(1440 + 1);
  });
});

test.describe("Hero film — mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });

  test("loads the mobile cut and scrubs from a touch drag", async ({ page }) => {
    await openHero(page);
    const start = await metrics(page);
    expect(start.currentSrc).toContain("hero-mobile.mp4");
    expect(start.paused).toBe(true);
    expect(start.currentTime).toBeLessThan(0.01);
    expect(start.overflow).toBeLessThanOrEqual(1);

    const client = await page.context().newCDPSession(page);
    const x = 195;
    const from = 620;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: from }],
    });
    for (let step = 1; step <= 8; step += 1) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: from - step * 45 }],
      });
      await page.waitForTimeout(18);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await page.waitForFunction(() => window.scrollY > 120, null, { timeout: 5000 });
    await page.waitForTimeout(500);
    const touched = await metrics(page);
    expect(touched.currentTime).toBeGreaterThan(0);
    expect(touched.paused).toBe(true);

    await scrollToProgress(page, 0.5);
    await waitForTime(page, start.duration * 0.5);
    const mid = await metrics(page);
    expect(Math.abs(mid.currentTime - start.duration * 0.5)).toBeLessThan(0.09);
    expect(mid.paused).toBe(true);
    expect(mid.overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("Hero film — reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

  test("shows the still hero and never loads or scrubs the film", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(HERO)).not.toHaveClass(/is-enhanced/);
    await expect(page.locator(VIDEO)).toBeHidden();
    await expect(page.locator(".hero__loader")).toBeHidden();
    await expect(page.locator(".hero__img")).toBeVisible();

    const before = await metrics(page);
    expect(before.sectionHeight).toBeLessThanOrEqual(before.viewportHeight + 2);
    expect(before.imageVisible).toBe(true);

    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(400);
    const after = await metrics(page);
    expect(after.currentTime).toBe(0);
    expect(after.currentSrc).toBe("");
  });
});

test.describe("Hero film — viewport changes", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });

  test("switches to the mobile cut and keeps scrubbing when the viewport narrows", async ({ page }) => {
    await openHero(page);
    expect((await metrics(page)).currentSrc).toContain("hero.mp4");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () => document.querySelector(".hero__video").currentSrc.includes("hero-mobile.mp4"),
      null,
      { timeout: 15000 }
    );
    await expect(page.locator(HERO)).toHaveClass(/is-ready/, { timeout: 15000 });

    const state = await metrics(page);
    expect(state.currentSrc).toContain("hero-mobile.mp4");
    expect(Math.abs(state.stickyHeight - state.viewportHeight)).toBeLessThanOrEqual(2);
    expect(state.overflow).toBeLessThanOrEqual(1);

    await scrollToProgress(page, 0.5);
    await waitForTime(page, state.duration * 0.5);
    const mid = await metrics(page);
    expect(Math.abs(mid.currentTime - state.duration * 0.5)).toBeLessThan(0.09);
    expect(mid.paused).toBe(true);
    expect(mid.stickyTop).toBe(0);
  });
});

test.describe("Hero film — short viewport", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });

  test("fits the pinned hero and its call to action on a landscape phone", async ({ page }) => {
    await openHero(page);
    const state = await metrics(page);
    expect(state.overflow).toBeLessThanOrEqual(1);
    expect(Math.abs(state.stickyHeight - state.viewportHeight)).toBeLessThanOrEqual(2);

    const boxes = await page.evaluate(() => {
      const rect = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, height: box.height };
      };
      return {
        header: rect(".site-header"),
        title: rect(".hero__title"),
        footer: rect(".hero__footer"),
        cta: rect(".hero__footer .btn"),
      };
    });
    expect(boxes.title.top).toBeGreaterThanOrEqual(boxes.header.bottom);
    expect(boxes.footer.bottom).toBeLessThanOrEqual(state.viewportHeight + 1);
    expect(boxes.cta.bottom).toBeLessThanOrEqual(state.viewportHeight + 1);
    expect(boxes.cta.height).toBeGreaterThanOrEqual(44);

    await scrollToProgress(page, 0.5);
    await waitForTime(page, state.duration * 0.5);
    const mid = await metrics(page);
    expect(Math.abs(mid.currentTime - state.duration * 0.5)).toBeLessThan(0.09);
    expect(mid.paused).toBe(true);
    expect(mid.stickyTop).toBe(0);
  });
});

test.describe("Hero film — load failure", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });

  test("falls back to the existing hero image", async ({ page }) => {
    await page.route("**/assets/video/*.mp4", (route) => route.abort());
    await page.goto("/");
    await expect(page.locator(HERO)).toHaveClass(/is-unavailable/, { timeout: 10000 });
    await expect(page.locator(VIDEO)).toBeHidden();
    await expect(page.locator(".hero__loader")).toBeHidden();
    await expect(page.locator(".hero__img")).toBeVisible();

    const state = await metrics(page);
    expect(state.sectionHeight).toBeLessThanOrEqual(state.viewportHeight + 2);
    expect(state.imageVisible).toBe(true);
    expect(state.overflow).toBeLessThanOrEqual(1);
  });
});
