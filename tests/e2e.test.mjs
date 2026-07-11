// End-to-end tests driven through a real browser. Exported as a function so
// the runner can supply a launched chromium and the served base URL.
import assert from "node:assert/strict";

export async function runE2E(chromium, baseURL) {
  const browser = await chromium.launch();
  const results = [];
  const run = async (name, fn) => {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(baseURL, { waitUntil: "networkidle" });
      await fn(page);
      assert.equal(errors.length, 0, "console/page errors: " + errors.join("; "));
      results.push({ name, ok: true });
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
    } finally {
      await page.close();
    }
  };

  await run("studio renders a cartoon on load", async (page) => {
    await page.waitForSelector("#studio-canvas img", { timeout: 5000 });
    const src = await page.getAttribute("#studio-canvas img", "src");
    assert.ok(src && src.startsWith("data:image/svg+xml"), "expected an SVG data URL");
    const engine = await page.textContent("#studio-engine");
    assert.match(engine, /Studio Demo Engine/);
  });

  await run("changing style updates the master prompt", async (page) => {
    await page.click('.style-card[data-style="noir"]');
    const prompt = await page.textContent("#studio-prompt");
    assert.match(prompt, /ink/i);
    const pressed = await page.getAttribute('.style-card[data-style="noir"]', "aria-pressed");
    assert.equal(pressed, "true");
  });

  await run("example chip fills subject and regenerates", async (page) => {
    const firstChip = page.locator(".chip").first();
    const text = (await firstChip.textContent()).trim();
    await firstChip.click();
    assert.equal((await page.inputValue("#studio-subject")).trim(), text);
    await page.waitForSelector("#studio-canvas img");
  });

  await run("download button enables after render", async (page) => {
    await page.waitForSelector("#studio-canvas img");
    assert.equal(await page.isDisabled("#studio-download"), false);
  });

  await run("gallery renders live engine artwork", async (page) => {
    await page.waitForSelector("#gallery-grid img");
    const count = await page.locator("#gallery-grid img").count();
    assert.ok(count >= 6, `expected gallery items, got ${count}`);
  });

  await run("billing toggle switches to annual pricing", async (page) => {
    const monthly = await page.locator(".plan .amount").first().textContent();
    // The checkbox is visually hidden; click the styled slider label instead.
    await page.locator(".billing-switch .slider").click();
    await page.waitForFunction(
      (m) => document.querySelector(".plan .amount").textContent !== m,
      monthly
    );
    const annual = await page.locator(".plan .amount").first().textContent();
    assert.notEqual(monthly, annual);
    assert.match(await page.textContent("#billing-label"), /Annual/);
  });

  await run("commercial quote recomputes on input", async (page) => {
    const before = await page.textContent("#quote-result .quote-total");
    await page.selectOption('#quote-form select[name="scope"]', "packaging");
    await page.selectOption('#quote-form select[name="reach"]', "global");
    await page.fill('#quote-form input[name="assets"]', "4");
    const after = await page.textContent("#quote-result .quote-total");
    assert.notEqual(before, after);
    await page.click('#quote-form button[type="submit"]');
    assert.match(await page.textContent("#quote-status"), /Quote locked/);
  });

  await run("print shop prices and orders", async (page) => {
    await page.selectOption('#print-form select[name="product"]', "canvas");
    await page.fill('#print-form input[name="qty"]', "10");
    assert.match(await page.textContent("#print-result .quote-sub"), /bulk discount/);
    await page.click('#print-form button[type="submit"]');
    assert.match(await page.textContent("#print-status"), /Order placed/);
  });

  await run("style-pack store adds to cart", async (page) => {
    await page.locator("#store-grid .pack button").first().click();
    assert.equal((await page.textContent("#cart-count")).trim(), "1");
    const total = await page.textContent("#cart-total");
    assert.notEqual(total.trim(), "£0");
  });

  await run("contact form validates then confirms", async (page) => {
    await page.click('#contact-form button[type="submit"]');
    assert.match(await page.textContent("#name-error"), /enter your name/);
    await page.fill('#contact-form input[name="name"]', "Ada");
    await page.fill('#contact-form input[name="email"]', "ada@example.com");
    await page.fill('#contact-form textarea[name="message"]', "I would like a cartoon of my cat.");
    await page.click('#contact-form button[type="submit"]');
    await page.waitForFunction(() =>
      document.getElementById("form-status").textContent.includes("touch")
    );
    assert.equal(await page.inputValue('#contact-form input[name="name"]'), "");
  });

  await run("mobile nav toggle opens and closes", async (page) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.click("#nav-toggle");
    assert.equal(await page.getAttribute("#nav-toggle", "aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await page.getAttribute("#nav-toggle", "aria-expanded"), "false");
  });

  await browser.close();
  return results;
}
