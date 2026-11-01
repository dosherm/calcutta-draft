# Costco stock checker

A GitHub Action (`.github/workflows/costco-stock-check.yml`) runs every 30 minutes.
It opens each Costco product page in `items.json` with headless Chromium and alerts you when one is buyable.

## Setup

1. **Add your item(s)** to `items.json`:
   ```json
   [
     { "name": "Kirkland Signature Widget", "url": "https://www.costco.com/....product.1234567.html" }
   ]
   ```
2. **Notifications:**
   - **GitHub issue (on by default):** opens an issue that @mentions you, so GitHub emails you. No setup needed, as long as you watch this repo (you do by default).
   - **Phone push (optional):** install the [ntfy](https://ntfy.sh) app and subscribe to a hard-to-guess topic, e.g. `costco-dan-8f3k2q`.
     Then add it as the repo secret **`NTFY_TOPIC`** (Settings → Secrets and variables → Actions).
3. **Test it:** Actions → "Costco stock check" → Run workflow → tick "Send a test notification".

## How it decides

The checker reads these signals in order: the **Add to Cart** button (whether it's present and enabled), then the schema.org `availability` data, then any "Out of Stock" text on the page.
Every run logs the raw signals in the "Check stock" step.

To avoid spam, you get **one alert per restock.** If the item sells out again, the issue closes itself, and the next restock opens a new one.

## Troubleshooting

- **`blocked`:** Costco's bot protection refused the request. It's often intermittent from GitHub's runners. If it keeps happening, run the workflow on a self-hosted runner or lower the frequency.
- **`unknown`:** the page layout didn't match. Open the page and find an element that only appears when the item is in stock. Add `"inStockSelector": "<css selector>"` to that item. You can also add `"outOfStockText": "regex"`.
- GitHub disables scheduled workflows after 60 days with no repo activity. Re-enable it from the Actions tab.

Run locally: `cd stock-checker && npm install && npx playwright install chromium && node check.mjs`
