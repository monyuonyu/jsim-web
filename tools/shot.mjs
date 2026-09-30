// 画面を撮る: node tools/shot.mjs URL 出力.png [待つミリ秒] [幅 高さ]
// 頁の console の出力と誤りも表示する。環境変数 SHOT_JS があれば、撮る前にその JS を頁で実行する（SHOT_WAIT ミリ秒待つ）
import { chromium } from "playwright-core";
const [url, out, wait = "3000", w = "1600", h = "900"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on("console", m => console.log("[console]", m.text()));
p.on("pageerror", e => console.log("[pageerror]", e.message));
await p.goto(url);
await p.waitForTimeout(+wait);
if (process.env.SHOT_JS) { console.log("[eval]", await p.evaluate(process.env.SHOT_JS)); await p.waitForTimeout(+(process.env.SHOT_WAIT ?? "1000")); }
if (out && out !== "-") await p.screenshot({ path: out });
const t = await p.evaluate(() => document.getElementById("out")?.textContent ?? "");
if (t) console.log(t.slice(0, 3000));
await b.close();
