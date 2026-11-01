// Costco stock checker.
//
// Loads each product page in items.json with a real (headless) browser, works
// out whether it can be bought, and writes results.json. Exits non-zero only
// on a crash; "blocked" / "unknown" pages are reported but don't fail the run.
//
// Usage: node check.mjs [path/to/items.json]

import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";

const itemsPath = process.argv[2] ?? new URL("./items.json", import.meta.url);
const items = JSON.parse(await readFile(itemsPath, "utf8"));

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const browser = await chromium.launch({
  args: ["--disable-blink-features=AutomationControlled"],
});
const context = await browser.newContext({
  userAgent: USER_AGENT,
  locale: "en-US",
  viewport: { width: 1366, height: 900 },
});
// Hide the most obvious headless tell.
await context.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
});

const results = [];
for (const item of items) {
  const result = await checkItem(item).catch((err) => ({
    status: "error",
    signals: { error: String(err?.message ?? err) },
  }));
  results.push({ name: item.name, url: item.url, ...result });
  console.log(`[${result.status.toUpperCase()}] ${item.name}`);
  console.log(`    ${JSON.stringify(result.signals)}`);
}

await browser.close();
await writeFile(
  new URL("./results.json", import.meta.url),
  JSON.stringify(results, null, 2),
);

/**
 * @returns {Promise<{status: "in_stock"|"out_of_stock"|"blocked"|"unknown"|"error", signals: object}>}
 */
async function checkItem(item) {
  const page = await context.newPage();
  try {
    const response = await page.goto(item.url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // Let client-side rendering settle (price / add-to-cart are often hydrated).
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(3_000);

    const httpStatus = response?.status() ?? 0;

    // Variant items (e.g. Hand: Right / Left): inspect, then select, the option.
    let option = null;
    if (item.option) {
      option = await page.evaluate(inspectOption, item.option);
      if (option.found && !option.unavailable) {
        await page
          .getByText(item.option, { exact: true })
          .first()
          .click({ timeout: 5_000 })
          .catch(() => {});
        await page.waitForTimeout(2_000);
      }
    }

    const signals = await page.evaluate(collectSignals, {
      inStockSelector: item.inStockSelector ?? null,
      outOfStockText: item.outOfStockText ?? null,
    });
    signals.httpStatus = httpStatus;
    if (option) signals.option = option;

    return { status: decide(signals), signals };
  } finally {
    await page.close();
  }
}

/**
 * Runs inside the page. Finds a variant option (button/swatch whose text is
 * exactly `label`) and reports whether it is marked unavailable (Costco
 * crosses out sold-out options).
 */
function inspectOption(label) {
  const want = label.trim().toLowerCase();
  const candidates = [...document.querySelectorAll(
    'button, [role="radio"], [role="button"], [role="option"], label, input[type="radio"], li, a',
  )].filter((el) => {
    const t = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().toLowerCase();
    return t === want || t.startsWith(want + ",") || t.startsWith(want + " ");
  });
  const el = candidates[0];
  if (!el) return { found: false };

  // Look at the element, its input (if a label), and a couple of ancestors.
  const related = [el, el.querySelector?.("input"), el.parentElement, el.parentElement?.parentElement]
    .filter(Boolean);
  const unavailRe = /disabled|unavailable|out-?of-?stock|\boos\b|sold-?out|strike|crossed|inactive/i;
  const hints = [];
  for (const r of related) {
    if (r.disabled) hints.push("disabled");
    if (r.getAttribute("aria-disabled") === "true") hints.push("aria-disabled");
    const aria = r.getAttribute("aria-label") || "";
    if (/unavailable|out of stock|sold out/i.test(aria)) hints.push(`aria-label:${aria}`);
    const cls = typeof r.className === "string" ? r.className : "";
    if (unavailRe.test(cls)) hints.push(`class:${cls.match(unavailRe)[0]}`);
  }
  // Strike-through graphic: only inside the option itself, so a crossed-out
  // sibling option (e.g. "Left") can't mark this one unavailable.
  if (el.querySelector?.("svg line, [class*='strike' i], [class*='cross' i], [class*='slash' i]")) {
    hints.push("strike-graphic");
  }
  return {
    found: true,
    tag: el.tagName.toLowerCase(),
    className: typeof el.className === "string" ? el.className.slice(0, 200) : "",
    unavailable: hints.length > 0,
    hints: [...new Set(hints)],
  };
}

/** Runs inside the page. Gathers every hint we can find about availability. */
function collectSignals({ inStockSelector, outOfStockText }) {
  const s = {};
  const bodyText = document.body?.innerText ?? "";
  s.title = document.title;
  s.accessDenied =
    /access denied|pardon our interruption|are you a robot/i.test(document.title) ||
    /you don't have permission to access/i.test(bodyText.slice(0, 2000));

  // 1. schema.org availability in JSON-LD or microdata.
  const avail = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node.availability === "string") avail.push(node.availability);
    Object.values(node).forEach(walk);
  };
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { walk(JSON.parse(el.textContent)); } catch {}
  }
  for (const el of document.querySelectorAll('[itemprop="availability"]')) {
    avail.push(el.getAttribute("content") || el.getAttribute("href") || "");
  }
  s.schemaAvailability = avail.map((a) => a.split("/").pop()).filter(Boolean);

  // 2. The Add to Cart button (old and new Costco page layouts).
  const btn = document.querySelector(
    [
      "#add-to-cart-btn",
      "input#add-to-cart-btn",
      '[data-testid*="add-to-cart" i]',
      '[automation-id*="addToCart" i]',
      'button[id*="add-to-cart" i]',
    ].join(","),
  ) ?? [...document.querySelectorAll("button, input[type=button], input[type=submit]")]
    .find((b) => /add to cart/i.test(b.innerText || b.value || ""));
  if (btn) {
    const label = (btn.innerText || btn.value || "").trim();
    s.addToCart = {
      label,
      disabled:
        btn.disabled ||
        btn.getAttribute("aria-disabled") === "true" ||
        /disabled|out-of-stock/i.test(btn.className),
    };
  }

  // 3. Visible "Out of Stock" wording.
  const oosPattern = outOfStockText
    ? new RegExp(outOfStockText, "i")
    : /\bout of stock\b|\bsold out\b|currently unavailable/i;
  s.outOfStockText = oosPattern.test(bodyText);

  // 4. Optional per-item override selector that only exists when in stock.
  if (inStockSelector) s.customSelectorFound = !!document.querySelector(inStockSelector);

  return s;
}

function decide(s) {
  if (s.accessDenied || s.httpStatus === 403) return "blocked";
  if (s.httpStatus >= 400) return "unknown";

  if ("customSelectorFound" in s) return s.customSelectorFound ? "in_stock" : "out_of_stock";

  // A crossed-out variant option is definitive.
  if (s.option?.found && s.option.unavailable) return "out_of_stock";

  if (s.addToCart) {
    const oosLabel = /out of stock|sold out|unavailable/i.test(s.addToCart.label);
    return s.addToCart.disabled || oosLabel ? "out_of_stock" : "in_stock";
  }

  if (s.schemaAvailability.some((a) => /OutOfStock|SoldOut|Discontinued/i.test(a))) return "out_of_stock";
  if (s.schemaAvailability.some((a) => /InStock|LimitedAvailability/i.test(a))) return "in_stock";

  if (s.outOfStockText) return "out_of_stock";
  return "unknown";
}
