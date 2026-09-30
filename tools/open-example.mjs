// JaamSim の .cfg を画面で開いて少し流し、/tmp/ex.png に撮る: node tools/open-example.mjs 例題.cfg（開発用のサーバーが 5199 で動いていること）
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on("pageerror", e => console.log("[pageerror]", e.message));
await p.goto("http://localhost:5199/?lang=ja");
await p.waitForTimeout(1500);
const text = readFileSync(process.argv[2], "utf8");
const r = await p.evaluate(t => {
	const j = window.jsim;
	try { j.engine.newModel(t, "ex.cfg"); } catch (e) { return "例外: " + e; }
	j.view.fit(); j.engine.speed = 500; j.engine.run();
	return j.ops.visibleObjects().map(e => e.getName()).join(", ") + (j.engine.warning ? " / 警告: " + j.engine.warning : "");
}, text);
console.log(r);
await p.waitForTimeout(4000);
await p.screenshot({ path: "/tmp/ex.png" });
await b.close();
