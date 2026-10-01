// 画面から使える、ファイルの開く・保存（Electron で動いている時だけ window.jsimHost がある）
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("jsimHost", {
	openModel: () => ipcRenderer.invoke("open-model"),
	saveModel: (path, text, as) => ipcRenderer.invoke("save-model", { path, text, as }),
	relaunchSoftGL: () => ipcRenderer.invoke("relaunch-soft-gl"),
	// AI チャット（キーは本体の側だけが持つ）
	ai: {
		status: () => ipcRenderer.invoke("ai:status"),
		setKey: key => ipcRenderer.invoke("ai:set-key", key),
		deleteKey: () => ipcRenderer.invoke("ai:delete-key"),
		send: text => ipcRenderer.invoke("ai:send", text),
		stop: () => ipcRenderer.invoke("ai:stop"),
		reset: () => ipcRenderer.invoke("ai:reset"),
		onEvent: fn => ipcRenderer.on("ai:event", (_e, ev) => fn(ev)),
		onToolCall: fn => ipcRenderer.on("ai:tool-call", async (_e, call) => {
			let result;
			try { result = await fn(call.name, call.input); }
			catch (err) { result = { text: String(err && err.message || err), isError: true }; }
			ipcRenderer.invoke("ai:tool-result", call.id, result);
		}),
	},
});
