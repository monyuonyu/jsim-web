/*
 * 多言語対応（i18n）。英語の元の文をキーにして、今の言語の文を引く。
 * Copyright (C) 2026 shota
 * Licensed under the Apache License, Version 2.0
 *
 * - tr("英語の文")              → 今の言語の文（辞書に無ければ英語のまま）
 * - jformat(tr("…%s…"), x)      → 書式も訳してから埋める（書式の %s などの数と順番は、訳でも同じにする）
 * - trName("ServiceTime", "keyword") → 名前（キーワード・出力・部品の種類）の表示名。ファイルの中の名前は変えない
 * 辞書は src/i18n/<言語>.json（{ "英語の文": "訳" }）。名前は "keyword:ServiceTime" のように種類を前に付けたキー。
 */

export type NameKind = "keyword" | "output" | "type" | "palette" | "unit" | "category";

let lang = "ja";
const dictionaries = new Map<string, Record<string, string>>();
const missing = new Set<string>();
let recordMissing = false;

export const I18n = {
	/** 使う言語（"ja"、"en" など）。"en" は辞書を引かず英語のまま */
	setLanguage(l: string): void {
		lang = l;
	},
	getLanguage(): string {
		return lang;
	},
	/** 辞書を足す（同じ言語に何度でも。後から足したものが勝つ） */
	addDictionary(l: string, dict: Record<string, string>): void {
		dictionaries.set(l, { ...(dictionaries.get(l) ?? {}), ...dict });
	},
	/** 辞書に無かった文を記録する（訳漏れ探し） */
	setRecordMissing(b: boolean): void {
		recordMissing = b;
	},
	getMissing(): string[] {
		return [...missing];
	},
};

function lookup(key: string): string | undefined {
	if (lang === "en")
		return undefined;
	const v = dictionaries.get(lang)?.[key];
	if (v === undefined && recordMissing)
		missing.add(key);
	return v;
}

/** 文を今の言語にする（無ければ元の英語） */
export function tr(s: string): string {
	return lookup(s) ?? s;
}

/** 名前の表示名（無ければ元の名前） */
export function trName(name: string, kind: NameKind): string {
	return lookup(`${kind}:${name}`) ?? name;
}
