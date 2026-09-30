import { defineConfig } from "vite";

// 画面（app/）。計算の部分（src/jaamsim）と資源（resources/）は、app の外から読む
export default defineConfig({
	root: "app",
	base: "./",
	server: { fs: { allow: [".."] } },
	build: { outDir: "../dist/app", emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 8000 },
});
