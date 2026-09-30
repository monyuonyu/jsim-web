// 画面の操作の試験（本物のマウスとキーで）: node tools/ui-test.mjs URL
// ライブラリからドラッグで置く → A を押しながらドラッグでつなぐ → 実行して品物が流れる → Delete で消す
import { chromium } from "playwright-core";
const url = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on("pageerror", e => console.log("[pageerror]", e.message));
await p.goto(url);
await p.waitForTimeout(1500);
let ng = 0;
const ok = (name, cond) => { console.log((cond ? "  OK  " : "  NG  ") + name); if (!cond) ng++; };
const count = () => p.evaluate(() => window.jsim.ops.visibleObjects().length);

const view = await p.locator("#view canvas").boundingBox();
const at = (fx, fy) => ({ x: view.x + view.width * fx, y: view.y + view.height * fy });
const drop = async (label, fx, fy) => {
	const item = p.locator(".lib-item", { hasText: label });
	await item.dragTo(p.locator("#view"), { targetPosition: { x: view.width * fx, y: view.height * fy } });
	await p.waitForTimeout(200);
};
await drop("ソース", 0.3, 0.5);
await drop("プロセッサ", 0.5, 0.5);
await drop("シンク", 0.7, 0.5);
ok("ライブラリからドラッグで 3 つ置ける", await count() === 3);
ok("置いた物が選ばれ、右に名前が出る", (await p.locator(".qp-name").inputValue()) === "シンク1");

const connect = async (a, c) => {
	const pa = at(...a), pc = at(...c);
	await p.mouse.move(pa.x, pa.y);
	await p.keyboard.down("a");
	await p.mouse.down();
	await p.mouse.move((pa.x + pc.x) / 2, pa.y, { steps: 5 });
	await p.mouse.move(pc.x, pc.y, { steps: 5 });
	await p.mouse.up();
	await p.keyboard.up("a");
	await p.waitForTimeout(200);
};
await connect([0.3, 0.5], [0.5, 0.5]);
await connect([0.5, 0.5], [0.7, 0.5]);
const links = await p.evaluate(() => window.jsim.ops.links().map(([a, b]) => a.getName() + "→" + b.getName()));
ok("A を押しながらドラッグでつながる: " + links.join(", "), links.includes("ソース1→プロセッサ1") && links.includes("プロセッサ1→シンク1"));

// 動かす: プロセッサを右下へドラッグ
const before = await p.evaluate(() => window.jsim.ops.position(window.jsim.ops.find("プロセッサ1")));
const pp = at(0.5, 0.5);
await p.mouse.move(pp.x, pp.y);
await p.mouse.down();
await p.mouse.move(pp.x + 60, pp.y + 40, { steps: 8 });
await p.mouse.up();
const after = await p.evaluate(() => window.jsim.ops.position(window.jsim.ops.find("プロセッサ1")));
ok(`ドラッグで動く (${before} → ${after})`, after[0] > before[0] && after[1] < before[1]);

// 実行
await p.keyboard.press("Escape");
await p.evaluate(() => { window.jsim.engine.speed = 100; });
await p.locator(".tb-btn", { hasText: "実行" }).click();
await p.waitForTimeout(3000);
const out = await p.evaluate(() => { const s = window.jsim.ops.find("シンク1"); return s.getNumberAdded(window.jsim.engine.simTime()); });
ok(`実行するとシンクに品物が入る (${out} 個)`, out > 0);
await p.locator(".tb-btn", { hasText: "停止" }).click();
await p.locator(".tb-btn", { hasText: "リセット" }).click();
ok("リセットで時間が 0 に戻る", (await p.evaluate(() => window.jsim.engine.simTime())) === 0);

// 選んで Delete
const sp = at(0.7, 0.5);
await p.mouse.click(sp.x, sp.y);
await p.keyboard.press("Delete");
await p.waitForTimeout(200);
ok("選んで Delete で消える", await count() === 2);

// 保存の中身（.cfg）
const text = await p.evaluate(() => window.jsim.engine.saveText());
ok("保存の中身に部品とつなぎがある", text.includes("Define EntityGenerator") && text.includes("ソース1 NextComponent"));

// 開き直し
const n = await p.evaluate(t => {
	try { window.jsim.engine.newModel(t, "x.cfg"); return window.jsim.ops.visibleObjects().length; }
	catch (e) { return String(e) + " / " + window.jsim.engine.log.slice(-3).join(" / ") + "\n" + t; }
}, text);
if (typeof n === "string") console.log(n);
ok("保存したものを開き直せる", n === 2);
await p.screenshot({ path: "/tmp/uitest.png" });
await b.close();
console.log(ng === 0 ? "すべて OK" : `NG ${ng} 件`);
process.exit(ng === 0 ? 0 : 1);
