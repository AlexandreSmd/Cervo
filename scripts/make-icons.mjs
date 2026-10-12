// Génère les icônes PNG (écran d'accueil du téléphone) et l'image d'aperçu des liens partagés
// (Messenger, WhatsApp… n'affichent pas les SVG) à partir de web/public/favicon.svg et logo.svg.
// Usage : node scripts/make-icons.mjs  (Chromium de Playwright)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { ROOT } from "./lib.mjs";

const PUBLIC = join(ROOT, "web", "public");
const fonts = join(ROOT, "node_modules", "@fontsource-variable");
const favicon = readFileSync(join(PUBLIC, "favicon.svg"), "utf8");
const logo = readFileSync(join(PUBLIC, "logo.svg"), "utf8");
// Polices intégrées (data URL) : une page sans adresse ne peut pas charger de fichier local.
const font = (path) => `url(data:font/woff2;base64,${readFileSync(join(fonts, path)).toString("base64")})`;
const KINDS = ["📖", "📏", "💡", "🧠", "📊", "⏳", "⚖️", "🕵️", "🧩", "✍️"];

const og = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Display; src: ${font("bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2")}; font-weight: 200 800; }
@font-face { font-family: Body; src: ${font("dm-sans/files/dm-sans-latin-wght-normal.woff2")}; font-weight: 100 1000; }
body { margin: 0; width: 1200px; height: 630px; background: #F4F5F8; font-family: Body; color: #111322; display: flex; flex-direction: column; justify-content: center; padding: 0 96px; box-sizing: border-box; }
.brand { display: flex; align-items: center; gap: 20px; font-family: Display; font-weight: 800; font-size: 104px; letter-spacing: -3px; }
.brand svg { width: 120px; height: 120px; }
.tagline { font-size: 44px; font-weight: 600; color: #5B4BFF; margin: 18px 0 44px; }
.kinds { display: flex; gap: 14px; }
.kinds span { width: 84px; height: 84px; border-radius: 22px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 44px; box-shadow: 0 2px 10px rgba(17,19,34,.06); }
.foot { margin-top: 36px; font-size: 30px; color: #70748C; font-weight: 600; }
</style></head><body>
<div class="brand">${logo}Vif</div>
<div class="tagline">Garde ton esprit affûté, vif et précis.</div>
<div class="kinds">${KINDS.map((k) => `<span>${k}</span>`).join("")}</div>
<div class="foot">10 défis par jour · sans aide · zéro IA</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  // Icône pleine (sans coins arrondis) : le téléphone applique son propre masque.
  const square = favicon.replace('rx="14"', 'rx="0"');
  await page.setContent(`<body style="margin:0">${square.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: join(PUBLIC, size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`) });
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(PUBLIC, "og-image.png") });
await browser.close();
console.log("Icônes et image d'aperçu générées dans web/public/.");
