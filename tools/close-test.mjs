// 窓を閉じる試験（Electron）。変更が無ければすぐ閉じる。流しただけでは変更に数えない。
// 変更があれば確かめの問いが出て、「キャンセル」なら閉じない、「保存しないで閉じる」なら閉じる。
// 使い方: npx vite build && xvfb-run -a node tools/close-test.mjs
import { _electron as electron } from "playwright-core";

let fails = 0;
const ok = (name, cond, extra = "") => { console.log(`  ${cond ? "OK" : "NG"}  ${name}${cond ? "" : "  " + extra}`); if (!cond) fails++; };

async function launch() {
	const app = await electron.launch({
		args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "."],
		env: { ...process.env, ELECTRON_DISABLE_SANDBOX: "1" },
	});
	const w = await app.firstWindow();
	await w.waitForTimeout(2500);
	// 問いの窓は出さずに、答えを決めておく
	await app.evaluate(({ dialog }) => {
		globalThis.__asked = 0;
		globalThis.__answer = 2;
		dialog.showMessageBox = async () => { globalThis.__asked++; return { response: globalThis.__answer, checkboxChecked: false }; };
	});
	const closed = new Promise(r => app.process().once("exit", () => r(true)));
	return { app, w, closed };
}
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(false), ms))]);
const requestClose = app => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());

// 1. 何もしないで閉じる
{
	const { app, closed } = await launch();
	await requestClose(app);
	ok("変更が無ければすぐ閉じる", await within(closed, 3000));
	if (!(await within(closed, 1))) app.process().kill();
}
// 2. 置いて、流して、閉じる
{
	const { app, w, closed } = await launch();
	await w.evaluate(() => { const o = window.jsim.ops; o.place("source", 0, 0); });
	await w.waitForTimeout(600);
	await w.evaluate(() => window.jsim.ops.engine.runFor(3600));
	await requestClose(app);
	await w.waitForTimeout(1000);
	ok("変更があれば問いが出る", (await app.evaluate(() => globalThis.__asked)) === 1);
	ok("キャンセルなら閉じない", !(await within(closed, 1500)));
	await app.evaluate(() => { globalThis.__answer = 1; });
	await requestClose(app);
	ok("保存しないで閉じるなら閉じる", await within(closed, 3000));
	if (!(await within(closed, 1))) app.process().kill();
}
// 3. 流しただけ（変更なし）で閉じる
{
	const { app, w, closed } = await launch();
	await w.evaluate(() => window.jsim.ops.engine.runFor(3600));
	await requestClose(app);
	ok("流しただけなら問わずに閉じる", await within(closed, 3000));
	if (!(await within(closed, 1))) app.process().kill();
}
console.log(fails ? `NG ${fails} 件` : "すべて OK");
process.exit(fails ? 1 : 0);
