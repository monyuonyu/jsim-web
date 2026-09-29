/*
 * TypeScript 版でモデルを画面なしで最後まで流し、RunOutputList の値を 1 行ずつ出す（ref/RefRun.java と同じ形）。
 * 使い方: node --import tsx tools/run-model.ts モデル.cfg
 */
import { resolve } from "node:path";
import { JaamSimModel, jstr } from "../src/jaamsim/internal.ts";
import type { RunListener } from "../src/jaamsim/basicsim/RunListener.ts";

// 仮: 自動で読む定義（autoload）にあるが、まだ移していない 2 つのクラス。本物ができたら消す
{
	const { ClassRegistry, DisplayEntity } = await import("../src/jaamsim/internal.ts");
	for (const n of ["com.jaamsim.ui.VideoRecorderEntity", "com.jaamsim.Examples.DemoEntity"])
		if (ClassRegistry.forName(n) === null)
			ClassRegistry.register(n, class extends DisplayEntity {});
}

const file = resolve(process.argv[2]);
const sm = new JaamSimModel(file.slice(file.lastIndexOf("/") + 1));
// 記録（誤りの文など）を画面にも出す
const { Log } = await import("../src/jaamsim/internal.ts");
let logIdx = 0;
Log.addListener({
	update() {
		for (const l of Log.getLog(logIdx)) { console.log("[記録] " + l); logIdx++; }
	},
});
sm.autoLoad();
sm.setBatchRun(true);
sm.configure(file);
sm.postLoad();
if (sm.getNumErrors() > 0) {
	console.log(`入力のエラー: ${sm.getNumErrors()} 件`);
	process.exit(2);
}
let ended = false;
const listener: RunListener = {
	runEnded() { ended = true; },
	handleRuntimeError(_m: unknown, t: unknown) {
		console.error(t);
		process.exit(3);
	},
} as RunListener;
sm.start(listener, null);
if (!ended)
	console.log("（注意: start から戻った時点で、まだ終わっていない）");
console.log("simTime\t" + jstr(sm.getSimTime()));
for (const s of sm.getSimulation()!.getRunOutputStrings(sm.getSimTime()))
	console.log(s);
