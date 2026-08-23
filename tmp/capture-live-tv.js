const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

async function main() {
  const { chromium } = require("playwright");
  const outDir = path.join(process.cwd(), "artifacts", "live-tv");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
  const page = await context.newPage();

  const capture = async (url, filename, waitForSelector) => {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector(waitForSelector, { timeout: 15000 });
    await page.screenshot({ path: path.join(outDir, filename) });
  };

  await capture("http://127.0.0.1:4017/crm-before", "crm-before.png", ".crm-live-screen.is-active");
  await capture("http://127.0.0.1:4017/crm-after", "crm-after.png", ".crm-live-screen.is-active");

  await page.goto("http://127.0.0.1:4017/cs", { waitUntil: "networkidle" });
  await page.waitForSelector(".crm-live-screen.is-active", { timeout: 15000 });
  await page.screenshot({ path: path.join(outDir, "cs-live-1-cancelamento.png") });
  await page.click("[data-crm-live-next]");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "cs-live-2-inadimplencia.png") });
  await page.click("[data-crm-live-next]");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "cs-live-3-presenca.png") });

  await browser.close();

  const digest = (filename) => crypto.createHash("sha256").update(fs.readFileSync(path.join(outDir, filename))).digest("hex");
  const crmBeforeHash = digest("crm-before.png");
  const crmAfterHash = digest("crm-after.png");

  const result = {
    outDir,
    crmBeforeHash,
    crmAfterHash,
    crmIdentical: crmBeforeHash === crmAfterHash,
  };
  process.stdout.write(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
