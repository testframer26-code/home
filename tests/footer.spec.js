const { test, expect } = require("@playwright/test");

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const NAV_GROUPS = [
  { heading: "Explore", toggle: "Toggle Explore links", panel: "#fcol-explore" },
  { heading: "Services", toggle: "Toggle Services links", panel: "#fcol-services" },
  { heading: "Company", toggle: "Toggle Company links", panel: "#fcol-company" },
  { heading: "Get in touch", toggle: "Toggle contact information", panel: "#fcol-contact" },
];

async function openFooter(page) {
  await page.goto("/#contact");
  await expect(page.locator(".site-footer")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("#newsletter-form")).toBeVisible();
}

async function box(locator) {
  const result = await locator.boundingBox();
  expect(result, "element should have a layout box").not.toBeNull();
  return result;
}

test.describe("Footer — desktop layout", () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await openFooter(page);
  });

  test("lays out four navigation columns beside the newsletter rail", async ({ page }) => {
    for (const group of NAV_GROUPS) {
      await expect(page.getByRole("heading", { name: group.heading, exact: true })).toBeVisible();
    }

    const toggles = page.locator(".fcol__toggle");
    await expect(toggles).toHaveCount(4);
    for (const toggle of await toggles.all()) {
      await expect(toggle).toBeHidden();
    }

    const panels = page.locator(".fcol__panel");
    await expect(panels).toHaveCount(4);
    for (const panel of await panels.all()) {
      await expect(panel).toBeVisible();
      await expect(panel.locator("li")).toHaveCount(4);
    }

    const columnCount = await page.locator(".footer__nav").evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns.split(/\s+/).filter(Boolean).length
    );
    expect(columnCount).toBe(4);

    const navBox = await box(page.locator(".footer__nav"));
    const newsletter = page.locator(".footer__newsletter");
    const newsletterBox = await box(newsletter);
    expect(newsletterBox.x).toBeGreaterThan(navBox.x + navBox.width + 20);
    expect(await newsletter.evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe("1px");

    const brandBox = await box(page.locator(".footer__brand-block"));
    const headlineBox = await box(page.locator(".footer__headline"));
    expect(headlineBox.x).toBeGreaterThan(brandBox.x + brandBox.width);
    await expect(page.locator(".footer__headline")).toContainText("Find Your Next");

    const cta = page.locator(".footer__cta");
    await expect(cta).toBeVisible();
    await expect(cta).toContainText(/let's talk/i);
    expect((await box(cta)).height).toBeGreaterThanOrEqual(44);

    await expect(page.locator(".footer__social-list a")).toHaveCount(4);
  });

  test("keeps the bottom bar, divider and signature wordmark intact", async ({ page }) => {
    const copyright = page.locator(".footer__copyright");
    const legal = page.locator(".footer__legal");
    await copyright.scrollIntoViewIfNeeded();

    const copyrightBox = await box(copyright);
    const legalBox = await box(legal);
    const centreDelta = Math.abs(
      copyrightBox.y + copyrightBox.height / 2 - (legalBox.y + legalBox.height / 2)
    );
    expect(centreDelta).toBeLessThanOrEqual(10);
    expect(legalBox.x).toBeGreaterThan(copyrightBox.x + copyrightBox.width);
    await expect(legal.locator("a")).toHaveCount(3);

    const bottomBar = page.locator(".footer__bottom");
    expect(await bottomBar.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("1px");

    const signature = page.locator(".footer__signature span");
    await signature.scrollIntoViewIfNeeded();
    await expect(signature).toBeVisible();

    const fontSize = parseFloat(await signature.evaluate((el) => getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThan(120);
    expect(await signature.evaluate((el) => el.scrollWidth <= el.clientWidth + 2)).toBe(true);

    const signatureBox = await box(signature);
    expect(signatureBox.x).toBeGreaterThanOrEqual(0);
    expect(signatureBox.x + signatureBox.width).toBeLessThanOrEqual(DESKTOP.width + 1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("Footer — mobile accordion", () => {
  test.use({ viewport: MOBILE, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await openFooter(page);
  });

  test("collapses navigation groups while contact details stay visible", async ({ page }) => {
    for (const group of NAV_GROUPS) {
      const toggle = page.getByRole("button", { name: group.toggle });
      const panel = page.locator(group.panel);
      await expect(toggle).toBeVisible();

      const toggleBox = await box(toggle);
      expect(toggleBox.width).toBeGreaterThanOrEqual(44);
      expect(toggleBox.height).toBeGreaterThanOrEqual(44);

      if (group.heading === "Get in touch") {
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("link", { name: "hello@leonhome.com" })).toBeVisible();
      } else {
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(panel).toBeHidden();
      }
    }
  });

  test("opens and closes accordions with accessible state", async ({ page }) => {
    const exploreToggle = page.getByRole("button", { name: "Toggle Explore links" });
    const explorePanel = page.locator("#fcol-explore");
    const servicesToggle = page.getByRole("button", { name: "Toggle Services links" });
    const servicesPanel = page.locator("#fcol-services");
    const contactToggle = page.getByRole("button", { name: "Toggle contact information" });
    const contactPanel = page.locator("#fcol-contact");

    await exploreToggle.click();
    await expect(exploreToggle).toHaveAttribute("aria-expanded", "true");
    await expect(explorePanel).toBeVisible();
    await expect(explorePanel.locator("a")).toHaveCount(4);
    await expect(explorePanel.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    const openTransform = await exploreToggle
      .locator(".fcol__icon")
      .evaluate((el) => getComputedStyle(el).transform);
    expect(openTransform).not.toBe("none");

    await exploreToggle.click();
    await expect(exploreToggle).toHaveAttribute("aria-expanded", "false");
    await expect(explorePanel).toBeHidden();

    await servicesToggle.click();
    await expect(servicesToggle).toHaveAttribute("aria-expanded", "true");
    await expect(servicesPanel).toBeVisible();
    await expect(exploreToggle).toHaveAttribute("aria-expanded", "false");
    await expect(explorePanel).toBeHidden();

    await contactToggle.click();
    await expect(contactToggle).toHaveAttribute("aria-expanded", "false");
    await expect(contactPanel).toBeHidden();
    await contactToggle.click();
    await expect(contactToggle).toHaveAttribute("aria-expanded", "true");
    await expect(contactPanel).toBeVisible();
  });

  test("keeps the newsletter full width and the signature inside the viewport", async ({ page }) => {
    const innerWidth = (await box(page.locator(".footer__inner"))).width;
    const newsletter = await box(page.locator(".footer__newsletter"));
    const formField = await box(page.locator(".newsletter-form__field"));
    expect(Math.abs(newsletter.width - innerWidth)).toBeLessThanOrEqual(2);
    expect(Math.abs(formField.width - innerWidth)).toBeLessThanOrEqual(2);

    const socialLinks = page.locator(".footer__social-list a");
    await expect(socialLinks).toHaveCount(4);
    for (const link of await socialLinks.all()) {
      const socialBox = await box(link);
      expect(socialBox.width).toBeGreaterThanOrEqual(44);
      expect(socialBox.height).toBeGreaterThanOrEqual(44);
    }

    const ctaBox = await box(page.locator(".footer__cta"));
    expect(ctaBox.width).toBeGreaterThanOrEqual(innerWidth - 2);
    expect(ctaBox.height).toBeGreaterThanOrEqual(44);

    const contactPanel = page.locator("#fcol-contact");
    await contactPanel.scrollIntoViewIfNeeded();
    await expect(contactPanel).toBeVisible();

    const signature = page.locator(".footer__signature span");
    await signature.scrollIntoViewIfNeeded();
    expect(await signature.evaluate((el) => el.scrollWidth <= el.clientWidth + 2)).toBe(true);

    const fontSize = parseFloat(await signature.evaluate((el) => getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(40);
    const signatureBox = await box(signature);
    expect(signatureBox.x + signatureBox.width).toBeLessThanOrEqual(MOBILE.width + 1);

    const copyrightBox = await box(page.locator(".footer__copyright"));
    const legalBox = await box(page.locator(".footer__legal"));
    expect(legalBox.y).toBeGreaterThan(copyrightBox.y);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
