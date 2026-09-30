// 画面から使える、ファイルの開く・保存（Electron で動いている時だけ window.jsimHost がある）
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("jsimHost", {
	openModel: () => ipcRenderer.invoke("open-model"),
	saveModel: (path, text, as) => ipcRenderer.invoke("save-model", { path, text, as }),
});
