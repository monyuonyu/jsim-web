// AI チャット（Electron の本体の側）。Claude Agent SDK（同梱の claude）で AI とやり取りし、
// AI が使う道具は画面の側（app/src/ai-tools.ts）で実行してもらう。KiCad・FreeCAD の AI チャットと同じ作り。
//
// - API キーは利用者が入れた物だけを使う。OS の鍵の仕組み（safeStorage）で暗号にして、利用者のデータの場所に置く。
//   画面の側にはキーを渡さない。
// - AI に送るのは、利用者が依頼した時の依頼の文と、AI が道具で読んだモデルの内容だけ（送り先は Anthropic の API）。
// - claude には jsim の道具だけを使わせる（ファイルやコマンドの道具は渡さない。利用者の設定も読ませない）。
const { app, ipcMain, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const MODEL = "opus";   // いちばん新しい Opus

// 本人用: この環境変数に Claude の長期トークン（claude setup-token で発行）があれば、API キーの代わりに使う。
// KiCad・FreeCAD の AI チャットと同じ名前。起動した時に読んで、すぐ環境から消す
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

/** 道具の定義（実行は画面の側）。[名前, 説明, 入力の形] */
function toolDefs(z) {
	const str = z.string(), num = z.number();
	return [
		["get_model", "今のモデル（部品の一覧・種類・位置・設定・つながり）と、実行の状態を返す", {}],
		["place_object", "部品を置く。置いた部品の名前を返す", {
			type: str.describe("部品の種類（source, queue, processor, sink, conveyor, delay, branch など）"),
			x: num.describe("x（m）"),
			y: num.describe("y（m）"),
			name: str.optional().describe("付けたい名前（省けば自動）"),
		}],
		["move_object", "部品を動かす・回す", {
			name: str, x: num, y: num,
			rotation_deg: num.optional().describe("向き（度）。省けば変えない"),
		}],
		["rename_object", "部品の名前を変える", { name: str, new_name: str }],
		["delete_object", "部品を消す（つながりも外れる）", { name: str }],
		["connect", "品物の流れをつなぐ（from から to へ）", { from: str, to: str }],
		["disconnect", "つながりを外す", { from: str, to: str }],
		["set_time", "時間の設定（到着間隔・処理時間・搬送時間など）を、定数か確率分布にする", {
			object: str,
			property: str.describe("InterArrivalTime, ServiceTime, TravelTime, Duration, FirstArrivalTime など"),
			kind: z.enum(["const", "exp", "uniform", "tri", "normal", "lognormal", "gamma", "weibull", "erlang"]),
			params: z.array(num),
			unit: z.enum(["s", "min", "h"]),
		}],
		["set_property", "時間以外の設定を変える（例: キューの MaxPerLine、リソースの Capacity、分岐の Choice、プロセッサの ResourceList）。値は JaamSim の入力の書き方", {
			object: str, property: str, value: str,
		}],
		["run_simulation", "最初からシミュレーションを流し、終わった時の部品ごとの統計を返す（画面にもその時点の結果が出る）", {
			hours: num.describe("流す長さ（時間）"),
		}],
		["get_stats", "今の時点の部品ごとの統計を返す", {}],
	];
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

let sessionId = null;   // 会話の続き（claude の会話の ID）
let abort = null;
let toolSeq = 0;
let sender = null;     // 今の依頼を出した画面
const pendingTools = new Map();

/** 画面の側で道具を実行してもらい、結果を待つ */
function callTool(name, input) {
	const id = ++toolSeq;
	return new Promise(resolve => {
		pendingTools.set(id, resolve);
		sender.send("ai:tool-call", { id, name, input });
	});
}

/** 同梱の claude の場所。asar の中のものは実行できないので、外に出した物（app.asar.unpacked）を指す。
 *  配布物では agent.bin という名前にしてある（tools/after-pack.cjs）。開発中は元の名前 */
function claudePath() {
	const pkg = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
	let dir;
	try { dir = path.dirname(require.resolve(`${pkg}/package.json`)); }
	catch { return undefined; }   // 無ければ SDK に任せる
	dir = dir.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
	for (const name of ["agent.bin", "claude.exe", "claude"]) {
		const f = path.join(dir, name);
		if (fs.existsSync(f)) return f;
	}
	return undefined;
}

let sdk = null;
let server = null;
async function loadSdk() {
	if (sdk) return;
	sdk = await import("@anthropic-ai/claude-agent-sdk");
	const { z } = await import("zod");
	const tools = toolDefs(z).map(([name, desc, shape]) => sdk.tool(name, desc, shape, async input => {
		sender.send("ai:event", { type: "tool", name, input });
		const r = await callTool(name, input);
		return { content: [{ type: "text", text: r.text }], isError: !!r.isError };
	}));
	server = sdk.createSdkMcpServer({ name: "jsim", version: "1", tools });
}

function options(key) {
	const env = { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", ENABLE_CLAUDEAI_MCP_SERVERS: "false" };
	delete env.ANTHROPIC_API_KEY;
	delete env.CLAUDE_CODE_OAUTH_TOKEN;
	if (oauthToken) env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
	else env.ANTHROPIC_API_KEY = key;
	const cwd = path.join(app.getPath("userData"), "ai-work");
	fs.mkdirSync(cwd, { recursive: true });
	return {
		model: MODEL, systemPrompt: SYSTEM,
		pathToClaudeCodeExecutable: claudePath(),
		tools: [], allowedTools: ["mcp__jsim__*"], permissionMode: "dontAsk",
		mcpServers: { jsim: server }, strictMcpConfig: true, settingSources: [],
		cwd, maxTurns: MAX_TURNS, env, includePartialMessages: true,
		abortController: abort, ...(sessionId ? { resume: sessionId } : {}),
	};
}

const AUTH_ERRORS = ["authentication_failed", "oauth_org_not_allowed"];

async function runTurn(text) {
	const key = oauthToken ? null : loadKey();
	if (!oauthToken && !key) {
		sender.send("ai:event", { type: "need_key" });
		return;
	}
	abort = new AbortController();
	sender.send("ai:event", { type: "start" });
	let error = null, authFailed = false;
	try {
		await loadSdk();
		for await (const m of sdk.query({ prompt: text, options: options(key) })) {
			if (m.session_id) sessionId = m.session_id;
			if (m.type === "stream_event" && !m.parent_tool_use_id) {
				const ev = m.event;
				if (ev.type === "content_block_delta" && ev.delta.type === "text_delta")
					sender.send("ai:event", { type: "text", delta: ev.delta.text });
			}
			else if (m.type === "assistant" && m.error) {
				if (AUTH_ERRORS.includes(m.error)) authFailed = true;
				else if (m.error === "rate_limit") error = "使いすぎの制限に当たった。少し待ってから送り直す";
				else if (m.error === "billing_error") error = "API の支払いの設定を確かめる（残高が無いなど）";
				else error = `API の誤り（${m.error}）`;
			}
			else if (m.type === "result") {
				if (m.subtype === "error_max_turns")
					error = `やり取りの回数の上限（${MAX_TURNS} 回）に達したので、途中で止めた。続けるには「続けて」と送る`;
				else if (m.is_error && !error && !authFailed) {
					const t = (m.subtype === "success" ? m.result : "") || m.subtype || "AI の回が失敗した";
					if (/401|authenticat/i.test(t)) authFailed = true;
					else error = t;
				}
			}
		}
	}
	catch (err) {
		if (abort.signal.aborted) error = "止めた";
		else if (/401|authenticat/i.test(String(err && err.message))) authFailed = true;
		else error = String(err && err.message || err);
	}
	finally {
		abort = null;
	}
	if (authFailed && oauthToken)
		error = `長期トークン（${TOKEN_ENV}）が正しくないか、期限が切れています。claude setup-token で発行し直してください`;
	else if (authFailed) sender.send("ai:event", { type: "bad_key" });
	if (error) sender.send("ai:event", { type: "error", text: error });
	sender.send("ai:event", { type: "done" });
}

function stopTools(why) {
	for (const [, resolve] of pendingTools) resolve({ text: why, isError: true });
	pendingTools.clear();
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
		stopTools("会話を始め直した");
		sessionId = null;
		return true;
	});
	ipcMain.handle("ai:stop", () => {
		if (abort) abort.abort();
		stopTools("止めた");
		return true;
	});
	ipcMain.handle("ai:send", (e, text) => {
		if (abort) return false;   // 走っている間は受けない
		sender = e.sender;
		void runTurn(String(text || ""));
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
