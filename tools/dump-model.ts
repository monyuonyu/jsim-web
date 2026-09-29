/*
 * TypeScript 版の全出力（ref/RefDump.java と同じ条件・同じ形）。
 * モデルを 1 回（反復 1 回・長さは 1000 時間まで）流し、全オブジェクトの全出力を「名前.出力<TAB>値」で出す。
 * 使い方: node --import tsx tools/dump-model.ts モデル.cfg
 */
import { resolve } from "node:path";
import { JaamSimModel, Entity, InputAgent, jstr } from "../src/jaamsim/internal.ts";
import type { RunListener } from "../src/jaamsim/basicsim/RunListener.ts";

const file = resolve(process.argv[2]);
const sm = new JaamSimModel(file.slice(file.lastIndexOf("/") + 1));
sm.autoLoad();
sm.setBatchRun(true);
sm.configure(file);
sm.postLoad();
if (sm.getNumErrors() > 0) {
	console.log("入力のエラー\t" + sm.getNumErrors());
	process.exit(2);
}
if (sm.getSimulation()!.getRunDuration() > 3600000.0)
	sm.setInput("Simulation", "RunDuration", "1000 h");
sm.setInput("Simulation", "NumberOfReplications", "1");
sm.setInput("Simulation", "PauseTime", "");
const listener: RunListener = {
	runEnded() {},
	handleRuntimeError(_m, t) { console.log("実行の誤り\t" + String(t)); },
};
sm.start(listener, null);
const t = sm.getSimTime();
console.log("simTime\t" + jstr(t));
for (const ent of sm.getClonesOfIterator(Entity)) {
	for (const out of ent.getAllOutputs()) {
		let s: string;
		try { s = InputAgent.getValueAsString(sm, out, t, "%s", 1.0, ""); }
		catch (e) { s = "誤り " + ((e as Error)?.constructor?.name ?? "?"); }
		console.log(ent.getName() + "." + out.getName() + "\t" + s.replace(/\n/g, " "));
	}
}
