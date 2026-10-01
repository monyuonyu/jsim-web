/*
 * AI チャットの枠（右の「AI」の欄）。AI とのやり取りは Electron の本体の側（electron/ai.cjs）がする。
 * ブラウザで開いた時は使えない（API キーを画面の側に置かないため）。
 */
import { t } from "./i18n.ts";
import type { AiTools, ToolResult } from "./ai-tools.ts";
import type { History } from "./history.ts";

interface AiHost {
	status(): Promise<{ hasKey: boolean; encrypted: boolean }>;
	setKey(key: string): Promise<boolean>;
	deleteKey(): Promise<boolean>;
	send(text: string): Promise<boolean>;
	stop(): Promise<boolean>;
	reset(): Promise<boolean>;
	onEvent(fn: (ev: { type: string; delta?: string; text?: string; name?: string; input?: unknown }) => void): void;
	onToolCall(fn: (name: string, input: Record<string, unknown>) => Promise<ToolResult> | ToolResult): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
	const e = document.createElement(tag);
	if (cls) e.className = cls;
	if (text) e.textContent = text;
	return e;
};

/** AI の返事の簡単な書式（**太字**・箇条書き・見出し）。HTML は使わせない */
function renderMarkdown(text: string): HTMLElement {
	const box = el("div", "ai-md");
	for (const line of text.split("\n")) {
		const p = el("div");
		let s = line;
		if (/^#{1,6}\s/.test(s)) { p.className = "ai-h"; s = s.replace(/^#{1,6}\s/, ""); }
		else if (/^\s*[-*]\s/.test(s)) { p.className = "ai-li"; s = "・" + s.replace(/^\s*[-*]\s/, ""); }
		const parts = s.split(/\*\*(.+?)\*\*/g);
		parts.forEach((part, i) => {
			if (i % 2 === 1) p.append(el("b", "", part));
			else p.append(document.createTextNode(part));
		});
		if (s === "") p.innerHTML = "&nbsp;";
		box.append(p);
	}
	return box;
}

export class AiChat {
	private host: AiHost | undefined;
	private log!: HTMLElement;
	private input!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private stopBtn!: HTMLButtonElement;
	private current: { box: HTMLElement; text: string } | null = null;
	private busy = false;

	constructor(readonly root: HTMLElement, readonly tools: AiTools, readonly history: History, readonly toast: (s: string) => void) {
		this.host = (window as unknown as { jsimHost?: { ai?: AiHost } }).jsimHost?.ai;
		this.build();
		if (!this.host) return;
		this.host.onEvent(ev => this.onEvent(ev));
		this.host.onToolCall((name, input) => this.tools.run(name, input));
	}

	private build(): void {
		this.root.innerHTML = "";
		this.log = el("div", "ai-log");
		this.root.append(this.log);
		if (!this.host) {
			this.note(t("The AI chat works in the app version (Windows / Linux), not in the browser."));
			return;
		}
		this.note(t("Ask the AI to look at, build or change the model, or to run it and explain the results. Each request can be undone in one step."));
		this.input = el("textarea", "ai-input");
		this.input.placeholder = t("Ask the AI (Enter to send, Shift+Enter for a new line)");
		this.input.onkeydown = ev => {
			if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); void this.send(); }
			ev.stopPropagation();
		};
		const row = el("div", "ai-buttons");
		const reset = el("button", "", t("New conversation"));
		reset.onclick = () => { void this.host!.reset(); this.log.innerHTML = ""; this.note(t("Started a new conversation.")); };
		const key = el("button", "", t("API key…"));
		key.onclick = () => void this.askKey();
		this.stopBtn = el("button", "", t("Stop"));
		this.stopBtn.onclick = () => void this.host!.stop();
		this.sendBtn = el("button", "primary", t("Send"));
		this.sendBtn.onclick = () => void this.send();
		row.append(reset, key, el("span", "ai-spacer"), this.stopBtn, this.sendBtn);
		this.root.append(this.input, row);
		this.setBusy(false);
	}

	private note(text: string, cls = "ai-note"): void {
		this.log.append(el("div", cls, text));
		this.log.scrollTop = this.log.scrollHeight;
	}

	private setBusy(b: boolean): void {
		this.busy = b;
		if (this.sendBtn) this.sendBtn.disabled = b;
		if (this.stopBtn) this.stopBtn.disabled = !b;
	}

	private async send(): Promise<void> {
		const text = this.input.value.trim();
		if (!text || this.busy) return;
		const st = await this.host!.status();
		if (!st.hasKey && !(await this.askKey())) return;
		this.input.value = "";
		this.log.append(el("div", "ai-user", text));
		this.log.scrollTop = this.log.scrollHeight;
		this.setBusy(true);
		await this.host!.send(text);
	}

	private onEvent(ev: { type: string; delta?: string; text?: string; name?: string; input?: unknown }): void {
		switch (ev.type) {
			case "start":
				// 1 回の依頼でした変更は、「元に戻す」1 回で戻せるように 1 段にまとめる
				this.history.begin();
				break;
			case "text":
				if (!this.current) {
					const box = el("div", "ai-reply");
					this.log.append(box);
					this.current = { box, text: "" };
				}
				this.current.text += ev.delta ?? "";
				this.current.box.replaceChildren(renderMarkdown(this.current.text));
				this.log.scrollTop = this.log.scrollHeight;
				break;
			case "tool":
				this.current = null;
				this.note(`🔧 ${toolLabel(ev.name ?? "", ev.input)}`, "ai-tool");
				break;
			case "error":
				this.current = null;
				this.note(ev.text ?? "", "ai-error");
				break;
			case "need_key":
				this.note(t("An API key is needed."), "ai-error");
				break;
			case "bad_key":
				this.note(t("The API key is not valid. Enter it again."), "ai-error");
				void this.askKey();
				break;
			case "done":
				this.current = null;
				this.history.end();
				this.setBusy(false);
				break;
		}
	}

	/** API キーを入れてもらう（送る物の説明つき）。入れたら true */
	private askKey(): Promise<boolean> {
		return new Promise(resolve => {
			const back = el("div", "ai-modal-back");
			const box = el("div", "ai-modal");
			box.append(el("div", "ai-modal-title", t("AI chat: API key")));
			box.append(el("p", "", t("The AI chat uses your own Anthropic API key (console.anthropic.com). Usage is billed to the key's owner.")));
			box.append(el("p", "", t("What is sent: only when you send a request, your request and the model contents the AI reads with its tools go to Anthropic's API. Nothing is sent otherwise.")));
			const inp = el("input");
			inp.type = "password";
			inp.placeholder = "sk-ant-...";
			box.append(inp);
			const row = el("div", "ai-buttons");
			const del = el("button", "", t("Remove the saved key"));
			const cancel = el("button", "", t("Cancel"));
			const ok = el("button", "primary", t("Save"));
			row.append(del, el("span", "ai-spacer"), cancel, ok);
			box.append(row);
			back.append(box);
			document.body.append(back);
			inp.focus();
			const close = (v: boolean) => { back.remove(); resolve(v); };
			cancel.onclick = () => close(false);
			del.onclick = async () => { await this.host!.deleteKey(); this.toast(t("Removed the saved API key.")); close(false); };
			ok.onclick = async () => {
				if (!inp.value.trim()) return;
				await this.host!.setKey(inp.value.trim());
				this.toast(t("Saved the API key."));
				close(true);
			};
			inp.onkeydown = ev => { if (ev.key === "Enter") ok.click(); if (ev.key === "Escape") cancel.click(); ev.stopPropagation(); };
		});
	}
}

function toolLabel(name: string, input: unknown): string {
	const i = (input ?? {}) as Record<string, unknown>;
	switch (name) {
		case "get_model": return t("Looking at the model");
		case "place_object": return t("Placing {0}", String(i.type));
		case "move_object": return t("Moving {0}", String(i.name));
		case "rename_object": return t("Renaming {0}", String(i.name));
		case "delete_object": return t("Deleting {0}", String(i.name));
		case "connect": return t("Connecting {0} → {1}", String(i.from), String(i.to));
		case "disconnect": return t("Disconnecting {0} → {1}", String(i.from), String(i.to));
		case "set_time": return t("Setting {0} of {1}", String(i.property), String(i.object));
		case "set_property": return t("Setting {0} of {1}", String(i.property), String(i.object));
		case "run_simulation": return t("Running the simulation for {0} h", String(i.hours));
		case "get_stats": return t("Reading the statistics");
		default: return name;
	}
}
