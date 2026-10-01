// AI チャットのやり取り（electron/ai.cjs、同梱の claude）の試験。Anthropic の API のふりをするサーバーを立て、Electron のアプリで
// 「道具（place_object）を呼ぶ → 結果を受けて答える」を通す。料金はかからない。
// claude は題名づけなどの通信もするので、jsim の道具の付いた依頼（本番）だけを数え、ほかには短い文を返す。
// 使い方: npm run build の後に xvfb-run -a node tools/ai-mock-test.mjs
import http from "node:http";
import { _electron as electron } from "playwright-core";

const requests = [];   // 本番の依頼
const headers = [];
const allRequests = [];
const isMain = j => (j.tools ?? []).some(t => String(t.name).endsWith("place_object"));
const useToken = process.argv.includes("--token");
const server = http.createServer((req, res) => {
	let body = "";
	req.on("data", c => body += c);
	req.on("end", () => {
		let j = {};
		try { j = JSON.parse(body || "{}"); } catch { /* 本文の無い問い合わせ */ }
		allRequests.push({ url: req.url, headers: req.headers });
		if (!req.url.startsWith("/v1/messages") || req.url.includes("count_tokens")) {
			res.writeHead(200, { "content-type": "application/json" });
			res.end(req.url.includes("count_tokens") ? JSON.stringify({ input_tokens: 10 }) : "{}");
			return;
		}
		const main = isMain(j);
		if (main) { requests.push(j); headers.push(req.headers); }
		res.writeHead(200, { "content-type": "text/event-stream" });
		const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
		const msg = { id: "msg_" + requests.length, type: "message", role: "assistant", model: j.model, content: [], stop_reason: null, stop_sequence: null,
			usage: { input_tokens: 10, output_tokens: 0 } };
		send("message_start", { type: "message_start", message: msg });
		if (!main) {
			send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
			send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "試験" } });
			send("content_block_stop", { type: "content_block_stop", index: 0 });
			send("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } });
		}
		else if (requests.length === 1) {
			send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
			send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ソースを置きます。" } });
			send("content_block_stop", { type: "content_block_stop", index: 0 });
			send("content_block_start", { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "mcp__jsim__place_object", input: {} } });
			send("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: JSON.stringify({ type: "source", x: 0, y: 0, name: "試験の到着" }) } });
			send("content_block_stop", { type: "content_block_stop", index: 1 });
			send("message_delta", { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 20 } });
		}
		else {
			send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
			send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "**できました。**" } });
			send("content_block_stop", { type: "content_block_stop", index: 0 });
			send("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } });
		}
		send("message_stop", { type: "message_stop" });
		res.end();
	});
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// JSIM_EXE に配布物の実行ファイルを渡すと、それを試す（同梱の claude が asar の外から動くかの確認）
const app = await electron.launch({
	...(process.env.JSIM_EXE ? { executablePath: process.env.JSIM_EXE } : {}),
	args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", ...(process.env.JSIM_EXE ? [] : ["."])],
	env: { ...process.env, ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`, ELECTRON_DISABLE_SANDBOX: "1",
		...(useToken ? { JA_CLAUDE_OAUTH_TOKEN: "sk-ant-oat-test" } : {}) },
});
const w = await app.firstWindow();
w.on("pageerror", e => console.log("[pageerror]", e.message));
await w.waitForTimeout(2500);
await w.evaluate(async (tok) => { if (!tok) await window.jsimHost.ai.setKey("sk-ant-test"); window.jsim.showRight("ai"); }, useToken);
await w.fill(".ai-input", "ソースを 1 つ置いて");
await w.click(".ai-buttons button.primary");
await w.waitForTimeout(4000);
const r = await w.evaluate(() => ({
	objects: window.jsim.ops.visibleObjects().map(e => e.getName()),
	log: document.querySelector(".ai-log").innerText,
	canUndo: window.jsim.history.canUndo(),
}));
await w.screenshot({ path: "/tmp/ai-mock.png" });
await w.fill(".ai-input", "名前を教えて");
await w.click(".ai-buttons button.primary");
await w.waitForTimeout(4000);
await w.evaluate(async () => { await window.jsimHost.ai.deleteKey(); });
app.process().kill();   // 変更ありの確認の窓を出さずに終える
server.close();

let ng = 0;
const ok = (n, c, info = "") => { console.log((c ? "  OK  " : "  NG  ") + n + (c ? "" : `（${info}）`)); if (!c) ng++; };
ok("1 回目の依頼で API に 2 回送った", requests.length >= 2, String(requests.length));
ok("モデルは Opus、jsim の道具だけ", /opus/.test(requests[0]?.model) && requests[0]?.tools?.length > 5 && requests[0].tools.every(t => t.name.startsWith("mcp__jsim__")), JSON.stringify({ m: requests[0]?.model, t: requests[0]?.tools?.map(t => t.name) }));
ok("2 回目に道具の結果を返した", JSON.stringify(requests[1]?.messages ?? []).includes("試験の到着（source）を置いた"), JSON.stringify(requests[1]?.messages?.slice(-1)));
ok("部品が置かれた", r.objects.includes("試験の到着"), r.objects.join(","));
ok("チャットに返事と道具が出た", r.log.includes("できました") && r.log.includes("🔧"), r.log);
ok("元に戻せる", r.canUndo);
if (useToken) ok("長期トークンは Bearer で送る", headers[0]?.authorization === "Bearer sk-ant-oat-test" && !headers[0]?.["x-api-key"], JSON.stringify({ a: headers[0]?.authorization, k: headers[0]?.["x-api-key"] }));
else ok("API キーは x-api-key で送る", headers[0]?.["x-api-key"] === "sk-ant-test" && !headers[0]?.authorization, JSON.stringify({ a: headers[0]?.authorization, k: headers[0]?.["x-api-key"] }));
ok("2 回目の依頼は前の会話の続き", JSON.stringify(requests[2]?.messages ?? []).includes("ソースを 1 つ置いて") && JSON.stringify(requests[2]?.messages ?? []).includes("名前を教えて"), String(requests.length));
console.log(ng === 0 ? "すべて OK" : `NG ${ng} 件`);
process.exit(ng === 0 ? 0 : 1);
