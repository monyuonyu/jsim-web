// AI チャットの道具（app/src/ai-tools.ts）の試験。AI を通さずに道具を直接呼ぶ: node tools/ai-tools-test.mjs [URL]
// 開発用のサーバー（npm run dev、5199）が動いていること
import { chromium } from "playwright-core";
const url = process.argv[2] ?? "http://localhost:5199/?lang=ja";
const b = await chromium.launch({ executablePath: process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on("pageerror", e => console.log("[pageerror]", e.message));
await p.goto(url);
await p.waitForTimeout(1500);
const res = await p.evaluate(() => {
	const j = window.jsim, T = j.aiTools, checks = [];
	const ok = (name, cond, info = "") => checks.push([name, !!cond, info]);
	const run = (n, i) => T.run(n, i);
	j.history.begin();
	ok("ソースを置く", !run("place_object", { type: "source", x: -8, y: 0, name: "到着" }).isError);
	ok("キューを置く", !run("place_object", { type: "queue", x: -4, y: 0, name: null }).isError);
	ok("プロセッサを置く", !run("place_object", { type: "processor", x: 0, y: 0, name: "加工" }).isError);
	ok("シンクを置く", !run("place_object", { type: "sink", x: 4, y: 0, name: null }).isError);
	ok("無い種類は誤り", run("place_object", { type: "xyz", x: 0, y: 0, name: null }).isError);
	ok("つなぐ 3 本", ["到着>キュー1", "キュー1>加工", "加工>シンク1"].every(s => { const [a, c] = s.split(">"); return !run("connect", { from: a, to: c }).isError; }));
	ok("到着間隔", !run("set_time", { object: "到着", property: "InterArrivalTime", kind: "exp", params: [60], unit: "s" }).isError);
	ok("処理時間", !run("set_time", { object: "加工", property: "ServiceTime", kind: "tri", params: [40, 50, 70], unit: "s" }).isError);
	ok("params の数の誤り", run("set_time", { object: "加工", property: "ServiceTime", kind: "tri", params: [40], unit: "s" }).isError);
	ok("無い部品は誤り", run("delete_object", { name: "無い" }).isError);
	const m = JSON.parse(run("get_model", {}).text);
	ok("get_model に 4 つとつながり 3 本", m.objects.length === 4 && m.links.length === 3, JSON.stringify(m.links));
	const s = JSON.parse(run("run_simulation", { hours: 8 }).text);
	ok("8 時間流して統計が出る", s.sim_time_hours === 8 && s["シンク1"] && s["シンク1"].NumberAdded > 300, JSON.stringify(s["シンク1"]) + " " + JSON.stringify(s["加工"]));
	ok("流した後に動かせる", !run("move_object", { name: "加工", x: 1, y: 2, rotation_deg: 90 }).isError && j.engine.state === "idle");
	j.history.end();
	j.history.undo();
	ok("元に戻す 1 回で全部戻る", j.ops.visibleObjects().length === 0, String(j.ops.visibleObjects().length));
	return checks;
});
let ng = 0;
for (const [n, c, info] of res) { console.log((c ? "  OK  " : "  NG  ") + n + (info && !c ? `（${info}）` : "")); if (!c) ng++; }
console.log(ng === 0 ? "すべて OK" : `NG ${ng} 件`);
await b.close();
process.exit(ng === 0 ? 0 : 1);
