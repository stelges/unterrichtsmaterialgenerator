import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMaterialPackageV2 } from "./v2/renderer-v2.js";
import { renderLearningDesignV3 } from "./v3/renderer-v3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readFile(relativePath) {
  try {
    return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
  } catch {
    return "";
  }
}

function buildPdfHtml(version, data) {
  const v2css = readFile("v2/v2.css");
  const v3css = version === "v3" ? readFile("v3/v3.css") : "";
  const body = version === "v3" ? renderLearningDesignV3(data) : renderMaterialPackageV2(data);
  const title = data?.meta?.title || "Unterrichtsmaterial";

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<title>${title.replaceAll("<", "&lt;")}</title>
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
${v2css}
${v3css}
/* PDF-specific overrides */
.material-v2{display:block;width:210mm;margin:0;padding:0;gap:0}
.v2-page{
  display:block;
  width:210mm;
  height:296.5mm;
  min-height:0;
  max-height:296.5mm;
  margin:0;
  padding:9mm 9mm 11mm;
  border-radius:0;
  box-shadow:none;
  page-break-after:always;
  break-after:page;
  overflow:hidden
}
.v2-page:last-child{page-break-after:auto;break-after:auto}
.v2-page-content{gap:6px;padding-top:6px;padding-bottom:12mm}
.v2-page h2{font-size:1.12rem}
.v2-kicker{font-size:.62rem;padding:2px 7px}
.v2-card{padding:6px 8px;border-radius:10px}
.v2-card h3{font-size:.86rem;margin-bottom:3px}
.v2-card p{font-size:.78rem;line-height:1.18;margin-bottom:3px}
.v2-list li,.v2-checklist li{font-size:.78rem;line-height:1.16;margin-bottom:3px}
.v2-table{font-size:.67rem;line-height:1.04}
.v2-table th,.v2-table td{padding:3px 4px}
.v2-table.spacious td{height:25px}
.v2-table.compact td{height:22px}
.v2-lines{gap:3px;margin-top:3px}
.v2-lines span{height:8px}
.v2-page-footer,.v2-page-header{font-size:.6rem}
.v2-page-footer{right:9mm;bottom:6mm;left:9mm}
</style>
</head>
<body>${body}</body>
</html>`;
}

let _browser = null;

async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  }
  return _browser;
}

export async function exportToPdf(version, data) {
  const html = buildPdfHtml(version, data);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return pdf;
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
