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
	const item = p.locator(`.lib-item:has(span:text-is("${label}"))`);
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

// 元に戻す（動かす前の位置に戻る）
await p.waitForTimeout(400);
await p.keyboard.press("Control+z");
await p.waitForTimeout(300);
const undone = await p.evaluate(() => window.jsim.ops.position(window.jsim.ops.find("プロセッサ1")));
ok(`Ctrl+Z で元に戻る (${undone})`, undone[0] === before[0] && undone[1] === before[1]);
await p.keyboard.press("Control+y");
await p.waitForTimeout(300);
const redone = await p.evaluate(() => window.jsim.ops.position(window.jsim.ops.find("プロセッサ1")));
ok(`Ctrl+Y でやり直せる (${redone})`, redone[0] === after[0] && redone[1] === after[1]);

// 部品の今の画面の位置
const screenOf = name => p.evaluate(n => {
	const j = window.jsim; const e = j.ops.find(n); const pos = e.getPosition();
	const v = new (j.view.camera.position.constructor)(pos.x, 0.5, -pos.y).project(j.view.camera);
	const r = j.view.renderer.domElement.getBoundingClientRect();
	return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
}, name);

// 右クリックのメニューで 90° 回す
await p.evaluate(() => window.jsim.view.fit());
await p.waitForTimeout(300);
const scr = await screenOf("プロセッサ1");
await p.mouse.click(scr[0], scr[1], { button: "right" });
await p.waitForTimeout(200);
ok("右クリックでメニューが出る", await p.locator(".ctx-menu").isVisible());
await p.locator(".ctx-menu .menu-item", { hasText: "90° 回転" }).click();
ok("メニューで 90° 回る", (await p.evaluate(() => window.jsim.ops.rotation(window.jsim.ops.find("プロセッサ1")))) === 90);

// ダブルクリックでプロパティの窓
await p.mouse.dblclick(scr[0], scr[1]);
await p.waitForTimeout(200);
ok("ダブルクリックでプロパティの窓が出る", await p.locator(".prop-window").isVisible());
await p.locator(".prop-window-head button").click();

// コピーと貼り付け
await p.keyboard.press("Control+c");
await p.keyboard.press("Control+v");
await p.waitForTimeout(200);
ok("Ctrl+C / Ctrl+V で写しができる", await count() === 4);
await p.keyboard.press("Control+z");
await p.waitForTimeout(400);
ok("貼り付けも元に戻せる", await count() === 3);

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
const sp = await screenOf("シンク1");
await p.mouse.click(sp[0], sp[1]);
await p.keyboard.press("Delete");
await p.waitForTimeout(200);
ok("選んで Delete で消える", await count() === 2 && (await p.evaluate(() => window.jsim.ops.find("シンク1"))) === null);

// 保存の中身（.cfg）
const text = await p.evaluate(() => window.jsim.engine.saveText());
ok("保存の中身に部品とつなぎがある", text.includes("Define EntityGenerator") && text.includes("ソース1 NextComponent"));

// 開き直し
const n = await p.evaluate(t => {
	try { window.jsim.engine.newModel(t, "x.cfg"); return window.jsim.ops.visibleObjects().length; }
	catch (e) { return String(e) + " / " + window.jsim.engine.log.slice(-3).join(" / ") + "\n" + t; }
}, text);
if (typeof n === "string") console.log(n);
if (n !== 2) console.log(text, "\n---\n", await p.evaluate(() => window.jsim.ops.visibleObjects().map(e => e.getName()).join(",")));
ok(`保存したものを開き直せる (${n} 個)`, n === 2);
await p.screenshot({ path: "/tmp/uitest.png" });
await b.close();
console.log(ng === 0 ? "すべて OK" : `NG ${ng} 件`);
process.exit(ng === 0 ? 0 : 1);
