// electron-builder の afterPack: 同梱の claude を agent.bin という名前にする（electron/ai.cjs の claudePath() がこの名前で探す）
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(ctx) {
	const base = path.join(ctx.appOutDir, "resources", "app.asar.unpacked", "node_modules", "@anthropic-ai");
	let renamed = 0;
	for (const dir of fs.existsSync(base) ? fs.readdirSync(base) : []) {
		if (!dir.startsWith("claude-agent-sdk-")) continue;
		for (const name of ["claude.exe", "claude"]) {
			const f = path.join(base, dir, name);
			if (fs.existsSync(f)) { fs.renameSync(f, path.join(base, dir, "agent.bin")); renamed++; }
		}
	}
	if (renamed === 0) throw new Error(`同梱の claude が見つからない: ${base}`);
};
