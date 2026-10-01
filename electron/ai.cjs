// AI チャット（Electron の本体の側）。Anthropic の API（@anthropic-ai/sdk、MIT）で AI とやり取りし、
// AI が使う道具は画面の側（app/src/ai-tools.ts）で実行してもらう。
//
// - API キーは利用者が入れた物だけを使う。OS の鍵の仕組み（safeStorage）で暗号にして、利用者のデータの場所に置く。
//   画面の側にはキーを渡さない。
// - AI に送るのは、利用者が依頼した時の依頼の文と、AI が道具で読んだモデルの内容だけ（送り先は Anthropic の API）。
const { app, ipcMain, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const AnthropicModule = require("@anthropic-ai/sdk");
const Anthropic = AnthropicModule.default ?? AnthropicModule;

const MODEL = "claude-opus-5-5";

// 本人用: この環境変数に Claude の長期トークン（claude setup-token で発行）があれば、API キーの代わりに使う。
// KiCad・FreeCAD の AI チャットと同じ名前。起動した時に読んで、すぐ環境から消す（子のプロセスに渡さない）
const TOKEN_ENV = "JA_CLAUDE_OAUTH_TOKEN";
const oauthToken = (process.env[TOKEN_ENV] || "").trim() || null;
delete process.env[TOKEN_ENV];
const MAX_TURNS = 60;   // 1 回の依頼で道具を呼んで進められる回数の上限

const SYSTEM = `あなたは離散事象シミュレーター jsim（FlexSim に似た画面。中身は JaamSim の移植）に組み込まれた助手です。
利用者と同じモデルを見ながら、モデルを調べ、作り、直し、シミュレーションを流して結果を説明します。
答えは利用者の言葉（日本語で話しかけられたら日本語）で、短く具体的に。表は使わず、見出し・箇条書き・**太字** だけで書く。

部品の種類（place_object の type）:
- source: ソース（品物が到着する。InterArrivalTime＝到着間隔）
- queue: キュー（待ち行列）
- processor: プロセッサ（1 つずつ処理する。ServiceTime＝処理時間）。直接つないでも、キューからつないでもよい
- sink: シンク（品物が出ていく）
- conveyor: コンベヤ（TravelTime＝搬送時間）
- delay: 搬送（遅れ。Duration）
- その他: branch（分岐）、assign、duplicate、gate、seize / release / resource（作業者などの資源）、stats、entproc（マルチプロセッサ）、combine、pack、unpack、assemble

つなぎ方: connect(from, to) で品物の流れをつなぐ。キューからはプロセッサ（など待ち行列から取る部品）にだけつなげる。
位置は床の上の m（x が右、y が奥）。部品は 3〜5 m ほど離して置くと見やすい。

時間の設定（set_time）: kind は const（定数）、exp（指数分布、params=[平均]）、uniform（[最小, 最大]）、tri（[最小, 最頻, 最大]）、
normal（[平均, 標準偏差]）、lognormal（[正規の平均, 正規の標準偏差]）、gamma（[平均, 形状]）、weibull（[尺度, 形状]）、erlang（[平均, 形状]）。unit は s / min / h。

進め方:
- 変える前に get_model で今のモデルを見る。部品は名前で指す
- 作ったり直したりしたら、run_simulation で流して結果を確かめてから「できた」と言う。確かめていないことは、確かめていないと言う
- 1 回の依頼でした変更は、利用者が「元に戻す」1 回で戻せる。何をしたかを一言で伝える
- 統計（稼働率・待ちの長さ・滞在時間・処理数）から、ボトルネックや改善案を具体的な数字で示す`;

/** 道具の定義（実行は画面の側） */
const TOOLS = [
	tool("get_model", "今のモデル（部品の一覧・種類・位置・設定・つながり）と、実行の状態を返す", {}),
	tool("place_object", "部品を置く。置いた部品の名前を返す", {
		type: { type: "string", description: "部品の種類（source, queue, processor, sink, conveyor, delay, branch など）" },
		x: { type: "number", description: "x（m）" },
		y: { type: "number", description: "y（m）" },
		name: { type: ["string", "null"], description: "付けたい名前（null なら自動）" },
	}),
	tool("move_object", "部品を動かす・回す", {
		name: { type: "string" },
		x: { type: "number" },
		y: { type: "number" },
		rotation_deg: { type: ["number", "null"], description: "向き（度）。null なら変えない" },
	}),
	tool("rename_object", "部品の名前を変える", { name: { type: "string" }, new_name: { type: "string" } }),
	tool("delete_object", "部品を消す（つながりも外れる）", { name: { type: "string" } }),
	tool("connect", "品物の流れをつなぐ（from から to へ）", { from: { type: "string" }, to: { type: "string" } }),
	tool("disconnect", "つながりを外す", { from: { type: "string" }, to: { type: "string" } }),
	tool("set_time", "時間の設定（到着間隔・処理時間・搬送時間など）を、定数か確率分布にする", {
		object: { type: "string" },
		property: { type: "string", description: "InterArrivalTime, ServiceTime, TravelTime, Duration, FirstArrivalTime など" },
		kind: { type: "string", enum: ["const", "exp", "uniform", "tri", "normal", "lognormal", "gamma", "weibull", "erlang"] },
		params: { type: "array", items: { type: "number" } },
		unit: { type: "string", enum: ["s", "min", "h"] },
	}),
	tool("set_property", "時間以外の設定を変える（例: キューの MaxPerLine、リソースの Capacity、分岐の Choice、プロセッサの ResourceList）。値は JaamSim の入力の書き方", {
		object: { type: "string" },
		property: { type: "string" },
		value: { type: "string" },
	}),
	tool("run_simulation", "最初からシミュレーションを流し、終わった時の部品ごとの統計を返す（画面にもその時点の結果が出る）", {
		hours: { type: "number", description: "流す長さ（時間）" },
	}),
	tool("get_stats", "今の時点の部品ごとの統計を返す", {}),
];

function tool(name, description, properties) {
	return {
		name, description, strict: true,
		input_schema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
	};
}

const keyFile = () => path.join(app.getPath("userData"), "ai-api-key.bin");

function loadKey() {
	try {
		const buf = fs.readFileSync(keyFile());
		return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString("utf8");
	}
	catch {
		return null;
	}
}

function saveKey(key) {
	const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key) : Buffer.from(key, "utf8");
	fs.mkdirSync(path.dirname(keyFile()), { recursive: true });
	fs.writeFileSync(keyFile(), data, { mode: 0o600 });
}

let messages = [];
let abort = null;
let toolSeq = 0;
const pendingTools = new Map();

/** 画面の側で道具を実行してもらい、結果を待つ */
function callTool(sender, name, input) {
	const id = ++toolSeq;
	return new Promise(resolve => {
		pendingTools.set(id, resolve);
		sender.send("ai:tool-call", { id, name, input });
	});
}

/** 止めた時などに、道具の結果の無い tool_use が履歴に残らないようにする（残ると次の依頼が誤りになる） */
function closeDanglingToolUses(why) {
	const last = messages[messages.length - 1];
	if (!last || last.role !== "assistant" || !Array.isArray(last.content)) return;
	const uses = last.content.filter(b => b.type === "tool_use");
	if (uses.length === 0) return;
	messages.push({ role: "user", content: uses.map(u => ({ type: "tool_result", tool_use_id: u.id, content: why, is_error: true })) });
}

async function runTurn(sender, text) {
	const key = oauthToken ? null : loadKey();
	if (!oauthToken && !key) {
		sender.send("ai:event", { type: "need_key" });
		return;
	}
	const client = oauthToken ? new Anthropic({ apiKey: null, authToken: oauthToken }) : new Anthropic({ apiKey: key });
	// 長期トークンの時は、その印の beta も付ける
	const betas = ["server-side-fallback-2026-07-01", ...(oauthToken ? ["oauth-2025-04-20"] : [])];
	abort = new AbortController();
	messages.push({ role: "user", content: text });
	sender.send("ai:event", { type: "start" });
	try {
		for (let turn = 0; ; turn++) {
			if (turn >= MAX_TURNS) {
				closeDanglingToolUses("回数の上限");
				sender.send("ai:event", { type: "error", text: `やり取りの回数の上限（${MAX_TURNS} 回）に達したので、途中で止めた。続けるには「続けて」と送る` });
				break;
			}
			const stream = client.beta.messages.stream({
				model: MODEL,
				max_tokens: 64000,
				// 断られた時は、Anthropic の勧める別のモデルで続ける
				betas,
				fallbacks: "default",
				thinking: { type: "adaptive" },
				output_config: { effort: "medium" },
				cache_control: { type: "ephemeral" },
				system: SYSTEM,
				tools: TOOLS,
				messages,
			}, { signal: abort.signal });
			stream.on("text", delta => sender.send("ai:event", { type: "text", delta }));
			const msg = await stream.finalMessage();
			messages.push({ role: "assistant", content: msg.content });
			if (msg.stop_reason === "refusal") {
				closeDanglingToolUses("断られた");
				sender.send("ai:event", { type: "error", text: "AI がこの依頼を断った" });
				break;
			}
			if (msg.stop_reason === "pause_turn") continue;
			const uses = msg.content.filter(b => b.type === "tool_use");
			if (uses.length === 0) break;
			if (msg.stop_reason === "max_tokens") {
				closeDanglingToolUses("出力の上限で切れた");
				sender.send("ai:event", { type: "error", text: "AI の出力が長すぎて切れた" });
				break;
			}
			const results = [];
			for (const u of uses) {
				sender.send("ai:event", { type: "tool", name: u.name, input: u.input });
				const r = await callTool(sender, u.name, u.input);
				results.push({ type: "tool_result", tool_use_id: u.id, content: r.text, is_error: !!r.isError });
			}
			messages.push({ role: "user", content: results });
			if (abort.signal.aborted) throw new Error("止めた");
		}
	}
	catch (err) {
		closeDanglingToolUses("止めた");
		if (abort.signal.aborted) sender.send("ai:event", { type: "error", text: "止めた" });
		else if (err instanceof Anthropic.AuthenticationError && oauthToken)
			sender.send("ai:event", { type: "error", text: `長期トークン（${TOKEN_ENV}）が正しくないか、期限が切れています。claude setup-token で発行し直してください` });
		else if (err instanceof Anthropic.AuthenticationError) sender.send("ai:event", { type: "bad_key" });
		else if (err instanceof Anthropic.RateLimitError) sender.send("ai:event", { type: "error", text: "使いすぎの制限に当たった。少し待ってから送り直す" });
		else if (err instanceof Anthropic.APIConnectionError) sender.send("ai:event", { type: "error", text: "Anthropic の API につながらない（ネットワークを確かめる）" });
		else if (err instanceof Anthropic.APIError) sender.send("ai:event", { type: "error", text: `API の誤り（${err.status}）: ${err.message}` });
		else sender.send("ai:event", { type: "error", text: String(err && err.message || err) });
	}
	finally {
		abort = null;
		sender.send("ai:event", { type: "done" });
	}
}

function setupAi() {
	ipcMain.handle("ai:status", () => ({ hasKey: !!oauthToken || !!loadKey(), encrypted: safeStorage.isEncryptionAvailable() }));
	ipcMain.handle("ai:set-key", (_e, key) => {
		key = String(key || "").trim();
		if (!key) return false;
		saveKey(key);
		return true;
	});
	ipcMain.handle("ai:delete-key", () => {
		try { fs.unlinkSync(keyFile()); } catch { /* 無ければよい */ }
		return true;
	});
	ipcMain.handle("ai:reset", () => {
		if (abort) abort.abort();
		messages = [];
		return true;
	});
	ipcMain.handle("ai:stop", () => {
		if (abort) abort.abort();
		for (const [, resolve] of pendingTools) resolve({ text: "止めた", isError: true });
		pendingTools.clear();
		return true;
	});
	ipcMain.handle("ai:send", (e, text) => {
		if (abort) return false;   // 走っている間は受けない
		void runTurn(e.sender, String(text || ""));
		return true;
	});
	ipcMain.handle("ai:tool-result", (_e, id, result) => {
		const resolve = pendingTools.get(id);
		pendingTools.delete(id);
		if (resolve) resolve(result);
		return true;
	});
}

module.exports = { setupAi };
