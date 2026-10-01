// Electron の入口: 画面（dist/app）を窓に出し、ファイルの開く・保存をつなぐ
const { app, BrowserWindow, dialog, ipcMain, Menu, protocol, net } = require("electron");
const { pathToFileURL } = require("node:url");
const { setupAi } = require("./ai.cjs");
const fs = require("node:fs");
const path = require("node:path");

// GPU が使えない PC（リモートデスクトップ・仮想マシン・古い GPU、サインイン前の起動など）でも、
// ソフトウェアで 3D を描けるようにする（読むのは同梱の画面だけなので、この許可の心配は当たらない）
app.commandLine.appendSwitch("enable-unsafe-swiftshader");
// それでも 3D を作れなかった時は、画面がこの印を付けて起動し直させる。印があれば、はじめからソフトウェアで描く
const SOFT_GL = "--jsim-soft-gl";
if (process.argv.includes(SOFT_GL)) {
	app.commandLine.appendSwitch("use-gl", "angle");
	app.commandLine.appendSwitch("use-angle", "swiftshader");
}

let win = null;
const ROOT = path.join(__dirname, "..", "dist", "app");

// 画面は app://jsim/ から出す（file:// では ES モジュールの読み込みが止められるため）
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

function createWindow() {
	win = new BrowserWindow({
		width: 1600, height: 950, minWidth: 900, minHeight: 600,
		title: "jsim",
		backgroundColor: "#eef1f4",
		webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
	});
	Menu.setApplicationMenu(null);  // メニューは画面の中に持つ（FlexSim と同じ位置）
	win.loadURL("app://jsim/index.html");
	if (process.env.JSIM_SELFTEST_SHOT) selfTest(process.env.JSIM_SELFTEST_SHOT);
}

// 試験用: 画面の中身（この窓だけ）を PNG に撮って終わる。サインインしていない PC でも ssh から確かめられる。
// JSIM_SELFTEST_SHOT=保存先.png、JSIM_SELFTEST_LANG=ja など
function selfTest(out) {
	const logs = [];
	win.webContents.on("console-message", (ev) => logs.push(`[${ev.level}] ${ev.message}`));
	win.webContents.once("did-finish-load", async () => {
		const wait = ms => new Promise(r => setTimeout(r, ms));
		try {
			const lang = process.env.JSIM_SELFTEST_LANG ?? "ja";
			await win.webContents.executeJavaScript(`localStorage.getItem("lang") === ${JSON.stringify(lang)} || (localStorage.setItem("lang", ${JSON.stringify(lang)}), location.reload())`);
			await wait(2500);
			const info = await win.webContents.executeJavaScript(`(() => {
				const j = window.jsim;
				if (!j) return "no jsim: " + document.body.innerText.slice(0, 300);
				document.querySelectorAll(".menu-item").forEach(m => { if (m.textContent.includes("サンプル") || m.textContent.includes("Sample")) m.click(); });
				j.engine.speed = 60; j.engine.run();
				return "gl=" + (j.view.renderer.getContext().getParameter(j.view.renderer.getContext().VERSION));
			})()`);
			logs.push("[selftest] " + info);
			await wait(6000);
			const img = await win.webContents.capturePage();
			fs.writeFileSync(out, img.toPNG());
			logs.push(`[selftest] saved ${img.getSize().width}x${img.getSize().height}`);
		}
		catch (e) {
			logs.push("[selftest] error " + (e && e.stack || e));
		}
		fs.writeFileSync(out + ".log", logs.join("\n"));
		app.exit(0);
	});
}

ipcMain.handle("relaunch-soft-gl", () => {
	if (process.argv.includes(SOFT_GL)) return false;  // もうソフトウェアで描いている
	app.relaunch({ args: process.argv.slice(1).concat([SOFT_GL]) });
	app.exit(0);
	return true;
});

ipcMain.handle("open-model", async () => {
	const r = await dialog.showOpenDialog(win, { filters: [{ name: "jsim / JaamSim", extensions: ["cfg"] }], properties: ["openFile"] });
	if (r.canceled || r.filePaths.length === 0) return null;
	const p = r.filePaths[0];
	return { path: p, name: path.basename(p), text: fs.readFileSync(p, "utf8") };
});

ipcMain.handle("save-model", async (_ev, { path: p, text, as }) => {
	let target = p;
	if (as || !target) {
		const r = await dialog.showSaveDialog(win, { defaultPath: target ?? "model.cfg", filters: [{ name: "jsim / JaamSim", extensions: ["cfg"] }] });
		if (r.canceled || !r.filePath) return null;
		target = r.filePath;
	}
	fs.writeFileSync(target, text, "utf8");
	return { path: target, name: path.basename(target) };
});

app.whenReady().then(() => {
	setupAi();
	protocol.handle("app", req => {
		const rel = decodeURIComponent(new URL(req.url).pathname);
		const file = path.normalize(path.join(ROOT, rel));
		if (!file.startsWith(ROOT)) return new Response("forbidden", { status: 403 });
		return net.fetch(pathToFileURL(file).toString());
	});
	createWindow();
});
app.on("window-all-closed", () => app.quit());
