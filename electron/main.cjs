// Electron の入口: 画面（dist/app）を窓に出し、ファイルの開く・保存をつなぐ
const { app, BrowserWindow, dialog, ipcMain, Menu, protocol, net } = require("electron");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");

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
}

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
	protocol.handle("app", req => {
		const rel = decodeURIComponent(new URL(req.url).pathname);
		const file = path.normalize(path.join(ROOT, rel));
		if (!file.startsWith(ROOT)) return new Response("forbidden", { status: 403 });
		return net.fetch(pathToFileURL(file).toString());
	});
	createWindow();
});
app.on("window-all-closed", () => app.quit());
