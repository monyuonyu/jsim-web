// 基本の操作の試験（Electron）。不具合探しで見つかった物が直ったままかを確かめる。
// 使い方: npx vite build && xvfb-run -a -s "-screen 0 1600x950x24" node tools/basic-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright-core";

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ng = 0;
const ok = (name, cond, info = "") => { console.log((cond ? "  OK  " : "  NG  ") + name + (cond ? "" : `（${info}）`)); if (!cond) ng++; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jsim-basic-"));

async function launch() {
	const app = await electron.launch({
		args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "."],
		env: { ...process.env, ELECTRON_DISABLE_SANDBOX: "1" },
	});
	const w = await app.firstWindow();
	const errs = [];
	w.on("pageerror", e => errs.push(e.message));
	await w.waitForTimeout(2500);
	// 本体の側の窓は出さずに答える。「閉じる」の問い（3 択）は __answer、「捨てますか」（2 択）は 0（捨てる）
	await app.evaluate(({ dialog }) => {
		globalThis.__asked = 0; globalThis.__answer = 2; globalThis.__discard = 0; globalThis.__saveDlg = 0;
		globalThis.__openPath = null; globalThis.__savePath = null;
		dialog.showMessageBox = async (...a) => {
			const o = a.find(x => x && x.buttons);
			if (o.buttons.length === 2) { globalThis.__discard++; return { response: 0 }; }
			globalThis.__asked++;
			return { response: globalThis.__answer };
		};
		dialog.showOpenDialog = async () => ({ canceled: !globalThis.__openPath, filePaths: [globalThis.__openPath] });
		dialog.showSaveDialog = async () => { globalThis.__saveDlg++; return globalThis.__savePath ? { canceled: false, filePath: globalThis.__savePath } : { canceled: true }; };
	});
	const closed = new Promise(r => app.process().once("exit", () => r(true)));
	const view = await w.locator("#view canvas").boundingBox();
	const drop = async (label, fx, fy) => {
		await w.locator(`.lib-item:has(span:text-is("${label}"))`).dragTo(w.locator("#view"), { targetPosition: { x: view.width * fx, y: view.height * fy } });
		await sleep(150);
	};
	const menu = async (top, item) => {
		await w.locator(`#menubar > .menu:nth-child(${top})`).click({ position: { x: 8, y: 8 } });
		await w.locator(`#menubar .menu.open .menu-item > span:first-child`, { hasText: item }).first().click();
		await sleep(500);
	};
	const g = name => app.evaluate((_e, n) => globalThis[n], name);
	const set = (name, v) => app.evaluate((_e, [n, x]) => { globalThis[n] = x; }, [name, v]);
	const names = () => w.evaluate(() => window.jsim.ops.visibleObjects().map(e => e.getName()));
	const within = (p, ms) => Promise.race([p, sleep(ms).then(() => false)]);
	const close = async () => { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()); await sleep(800); };
	const kill = async () => { if (!(await within(closed, 1))) app.process().kill(); };
	/** 部品の画面の上の位置 */
	const screenOf = n => w.evaluate(n => {
		const j = window.jsim, v = j.view, p = j.ops.find(n).getPosition();
		const vec = v.camera.position.clone().set(p.x, 0.5, -p.y).project(v.camera);
		const r = v.renderer.domElement.getBoundingClientRect();
		return [r.left + (vec.x + 1) / 2 * r.width, r.top + (1 - vec.y) / 2 * r.height];
	}, n);
	return { app, w, errs, closed, drop, menu, g, set, names, within, close, kill, screenOf };
}

// 1. ライブラリからドラッグで置いた直後に閉じると問われる。元に戻すは 1 つずつ
{
	const h = await launch();
	await h.drop("ソース", 0.4, 0.5);
	await h.close();
	ok("ドラッグで置いた直後に閉じると、保存するか問われる", (await h.g("__asked")) === 1 && !(await h.within(h.closed, 1)));
	await h.drop("シンク", 0.6, 0.5);
	await h.w.keyboard.press("Control+z"); await sleep(300);
	const a = await h.names();
	await h.w.keyboard.press("Control+y"); await sleep(300);
	const b = await h.names();
	ok("元に戻すはシンクだけ、やり直すで戻る", a.join() === "ソース1" && b.join() === "ソース1,シンク1", `${a} / ${b}`);
	await h.kill();
}
// 2. 実行して止めた後の編集も変更に数える
{
	const h = await launch();
	await h.menu(1, "サンプルモデルを開く");
	await h.w.evaluate(() => window.jsim.engine.runFor(600));
	await h.drop("シンク", 0.5, 0.8);
	await h.close();
	ok("実行の後に置いた物も、閉じる時に問われる", (await h.g("__asked")) === 1);
	ok("実行の後の編集も元に戻せる", await h.w.evaluate(() => window.jsim.history.canUndo()));
	await h.kill();
}
// 3・6. 開いた後にサンプルにしたら、上書き保存せず名前を聞く。状態の行のファイル名
{
	const h = await launch();
	const victim = path.join(tmp, "victim.cfg");
	await h.menu(1, "サンプルモデルを開く");
	await h.set("__savePath", victim);
	await h.w.keyboard.press("Control+s"); await sleep(800);
	const original = fs.readFileSync(victim, "utf8");
	await h.set("__savePath", null);
	await h.set("__openPath", victim);
	await h.menu(1, "モデルを開く");
	const st1 = await h.w.locator("#statusbar").textContent();
	ok("開いたら状態の行にファイル名", st1.includes("victim.cfg"), st1);
	await h.drop("ソース", 0.3, 0.2);
	await h.menu(1, "サンプルモデルを開く");
	const before = await h.g("__saveDlg");
	await h.w.keyboard.press("Control+s"); await sleep(800);
	ok("サンプルにした後の保存は名前を聞く（開いていたファイルを上書きしない）", (await h.g("__saveDlg")) === before + 1 && fs.readFileSync(victim, "utf8") === original);
	ok("捨てる前に問われた", (await h.g("__discard")) >= 1);
	await h.menu(1, "新規モデル");
	const st2 = await h.w.locator("#statusbar").textContent();
	ok("新規にしたら状態の行は（未保存）", st2.includes("（未保存）"), st2);
	await h.kill();
}
// 4. 言語を変えてもモデルが残る
{
	const h = await launch();
	await h.drop("ソース", 0.4, 0.5);
	await h.menu(3, "English"); await sleep(2500);
	const n = await h.names();
	ok("言語を変えてもモデルは残り、変更ありのまま", n.length === 1 && await h.w.evaluate(() => window.jsim.history.isDirty()), n.join());
	await h.w.evaluate(() => localStorage.clear());
	await h.kill();
}
// 5・8・12. プロパティの窓・右の欄の位置・貼り付け
{
	const h = await launch();
	await h.menu(1, "サンプルモデルを開く");
	const [x, y] = await h.screenOf("プロセッサ1");
	await h.w.mouse.dblclick(x, y); await sleep(400);
	await h.w.mouse.click(x, y); await sleep(200);
	await h.w.keyboard.press("Delete"); await sleep(400);
	ok("消した部品のプロパティの窓は閉じる", (await h.w.locator(".prop-window").count()) === 0);
	const [x2, y2] = await h.screenOf("プロセッサ2");
	await h.w.mouse.click(x2, y2); await sleep(200);
	await h.w.locator("#props .qp-section .qp-head", { hasText: "位置" }).click();
	await h.w.mouse.move(x2, y2); await h.w.mouse.down(); await h.w.mouse.move(x2 + 100, y2 + 60, { steps: 8 }); await h.w.mouse.up(); await sleep(600);
	const xy = await h.w.evaluate(() => [...document.querySelectorAll("#props .qp-row")].filter(r => /^[XY] \(m\)/.test(r.textContent)).map(r => Number(r.querySelector("input").value)));
	const model = await h.w.evaluate(() => window.jsim.ops.position(window.jsim.ops.find("プロセッサ2")));
	ok("ドラッグで動かすと右の欄の X/Y も変わる", xy.length === 2 && Math.abs(xy[0] - model[0]) < 1e-6 && Math.abs(xy[1] - model[1]) < 1e-6 && model[0] !== 0, `${xy} / ${model}`);
	ok("節は開いたまま", await h.w.locator("#props .qp-section.open .qp-head", { hasText: "位置" }).count() === 1);
	await h.w.keyboard.press("Control+c");
	await h.w.keyboard.press("Control+v"); await sleep(200);
	await h.w.keyboard.press("Control+v"); await sleep(200);
	const pos = await h.w.evaluate(() => window.jsim.ops.visibleObjects().filter(e => e.getName().startsWith("プロセッサ")).map(e => window.jsim.ops.position(e).join(",")));
	ok("貼り付けを繰り返しても重ならない", new Set(pos).size === pos.length && pos.length === 3, pos.join(" / "));
	await h.kill();
}
// 7・9・11. 停止時間の欄・停止時間に達した後の実行・受け付けない値
{
	const h = await launch();
	await h.menu(1, "サンプルモデルを開く");
	await h.w.mouse.click(5, 300);   // 何も選ばない（右の欄はモデルの設定）
	await h.w.evaluate(() => window.jsim.view.setSelection([]));
	const tbStop = h.w.locator("#toolbar input[type=number]");
	await tbStop.fill("0.01"); await tbStop.press("Enter"); await sleep(300);
	const right = await h.w.locator("#props input[type=number]").first().inputValue();
	ok("ツールバーの停止時間が右の欄にも出る", right === "0.01", right);
	await h.w.locator("#props input[type=number]").first().fill("0.02");
	await h.w.locator("#props input[type=number]").first().press("Enter"); await sleep(300);
	ok("右の欄の停止時間がツールバーにも出る", (await tbStop.inputValue()) === "0.02");
	// 既定の速さ（約 10 倍）で早く着くように、短くしてから流す
	await tbStop.fill("0.0005"); await tbStop.press("Enter"); await sleep(200);
	await h.w.locator(".tb-btn[title='実行']").click();
	await sleep(2500);
	const s = await h.w.evaluate(() => ({ st: window.jsim.engine.state, t: window.jsim.engine.simTime() }));
	ok("停止時間に達したら実行ボタンは押せない", s.st === "paused" && await h.w.locator(".tb-btn[title='実行']").isDisabled(), JSON.stringify(s));
	await h.w.keyboard.press(" "); await sleep(300);
	ok("Space でも進まず、知らせが出る", (await h.w.locator("#toast").textContent()).includes("停止時間"));
	await h.w.locator(".tb-btn[title='リセット']").click(); await sleep(300);
	const [qx, qy] = await h.screenOf("キュー1");
	await h.w.mouse.click(qx, qy); await sleep(300);
	const intIn = h.w.locator("#props input[step='1']").first();
	const was = await intIn.inputValue();
	await intIn.fill("-3"); await intIn.press("Enter"); await sleep(300);
	ok("受け付けない値は欄が元に戻る", (await intIn.inputValue()) === was, await intIn.inputValue());
	const nm = h.w.locator("#props .qp-name");
	await nm.fill(""); await nm.press("Enter"); await sleep(200);
	ok("名前を空にすると欄は元の名前", (await nm.inputValue()) === "キュー1");
	await h.kill();
}
// 13. 部品の名前が Box でも、品物はソースの品物
{
	const h = await launch();
	await h.drop("キュー", 0.4, 0.5);
	const nm = h.w.locator("#props .qp-name");
	await nm.fill("Box"); await nm.press("Enter"); await sleep(200);
	await h.drop("ソース", 0.6, 0.5);
	const proto = await h.w.evaluate(() => { const o = window.jsim.ops; const s = o.find("ソース1"); return o.engine.getInputString(s, "PrototypeEntity"); });
	ok("名前が Box の部品を品物にしない", proto !== "Box" && proto !== "", proto);
	await h.kill();
}
console.log(ng === 0 ? "すべて OK" : `NG ${ng} 件`);
process.exit(ng === 0 ? 0 : 1);
