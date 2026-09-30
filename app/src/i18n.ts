/*
 * 画面の言葉。キーは英語の文、値は各言語の訳（無ければキーのまま）。
 * 言語は localStorage の "lang"、無ければブラウザの言語（日本語なら ja）。
 */
import ja from "./lang/ja.json";

const dicts: Record<string, Record<string, string>> = { ja, en: {} };
let lang = new URLSearchParams(location.search).get("lang") ?? localStorage.getItem("lang") ?? (navigator.language.startsWith("ja") ? "ja" : "en");
if (!(lang in dicts)) lang = "en";

export function getLang(): string {
	return lang;
}

export function setLang(l: string): void {
	localStorage.setItem("lang", l);
	location.reload();
}

export const LANGS: [string, string][] = [["ja", "日本語"], ["en", "English"]];

/** 訳す。{0} {1} … は引数で置き換える */
export function t(key: string, ...args: (string | number)[]): string {
	let s = dicts[lang][key] ?? key;
	args.forEach((a, i) => { s = s.replace(`{${i}}`, String(a)); });
	return s;
}
