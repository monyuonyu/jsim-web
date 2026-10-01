// AI チャットのやり取り（electron/ai.cjs）の試験。Anthropic の API のふりをするサーバーを立て、Electron のアプリで
// 「道具（place_object）を呼ぶ → 結果を受けて答える」を通す。料金はかからない。
// 使い方: npm run build の後に xvfb-run -a node tools/ai-mock-test.mjs
import http from "node:http";
import { _electron as electron } from "playwright-core";

const requests = [];
const headers = [];
const useToken = process.argv.includes("--token");
const server = http.createServer((req, res) => {
	let body = "";
	req.on("data", c => body += c);
	req.on("end", () => {
		const j = JSON.parse(body || "{}");
		requests.push(j);
		headers.push(req.headers);
		res.writeHead(200, { "content-type": "text/event-stream" });
		const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
		const msg = { id: "msg_" + requests.length, type: "message", role: "assistant", model: j.model, content: [], stop_reason: null, stop_sequence: null,
			usage: { input_tokens: 10, output_tokens: 0 } };
		send("message_start", { type: "message_start", message: msg });
		if (requests.length === 1) {
			send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
			send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ソースを置きます。" } });
			send("content_block_stop", { type: "content_block_stop", index: 0 });
			send("content_block_start", { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "place_object", input: {} } });
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

const app = await electron.launch({
	args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "."],
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
await w.evaluate(async () => { await window.jsimHost.ai.deleteKey(); });
app.process().kill();   // 変更ありの確認の窓を出さずに終える
server.close();

let ng = 0;
const ok = (n, c, info = "") => { console.log((c ? "  OK  " : "  NG  ") + n + (c ? "" : `（${info}）`)); if (!c) ng++; };
ok("API に 2 回送った", requests.length === 2, String(requests.length));
ok("モデルは claude-opus-5-5、道具と予備のモデルの指定つき", requests[0]?.model === "claude-opus-5-5" && requests[0]?.tools?.length > 5 && requests[0]?.fallbacks === "default");
ok("2 回目に道具の結果を返した", JSON.stringify(requests[1]?.messages ?? []).includes("試験の到着（source）を置いた"), JSON.stringify(requests[1]?.messages?.slice(-1)));
ok("部品が置かれた", r.objects.includes("試験の到着"), r.objects.join(","));
ok("チャットに返事と道具が出た", r.log.includes("できました") && r.log.includes("🔧"), r.log);
ok("元に戻せる", r.canUndo);
if (useToken) ok("長期トークンは Bearer と oauth の印で送る", headers[0]?.authorization === "Bearer sk-ant-oat-test" && !headers[0]?.["x-api-key"] && String(headers[0]?.["anthropic-beta"]).includes("oauth-2025-04-20"), JSON.stringify({ a: headers[0]?.authorization, k: headers[0]?.["x-api-key"], b: headers[0]?.["anthropic-beta"] }));
else ok("API キーは x-api-key で送る", headers[0]?.["x-api-key"] === "sk-ant-test" && !String(headers[0]?.["anthropic-beta"]).includes("oauth"), JSON.stringify(headers[0]?.["anthropic-beta"]));
console.log(ng === 0 ? "すべて OK" : `NG ${ng} 件`);
process.exit(ng === 0 ? 0 : 1);
