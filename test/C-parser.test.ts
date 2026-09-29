// Parser（字句の分け方など）が Java 版と同じ結果を出すこと。
// 正解（REF）は、Java の com.jaamsim.input.Parser をそのまま java で走らせて作ったもの。
import { test } from "node:test";
import assert from "node:assert/strict";
import { Parser, jsplit, jtrim } from "../src/jaamsim/input/Parser.ts";

type Ref = Record<string, unknown>;
const REF: Ref[] = [{"rec":"Define Server { S1 S2 }","strip":false,"quoted":false,"tokens":["Define","Server","{","S1","S2","}"]},
{"rec":"Define Server { S1 S2 }","strip":true,"quoted":false,"tokens":["Define","Server","{","S1","S2","}"]},
{"rec":"S1 ServiceTime { 3 s }  # comment","strip":false,"quoted":false,"tokens":["S1","ServiceTime","{","3","s","}","# comment"]},
{"rec":"S1 ServiceTime { 3 s }  # comment","strip":true,"quoted":false,"tokens":["S1","ServiceTime","{","3","s","}"]},
{"rec":"S1 Desc { 'a b c' }","strip":false,"quoted":false,"tokens":["S1","Desc","{","a b c","}"]},
{"rec":"S1 Desc { 'a b c' }","strip":true,"quoted":false,"tokens":["S1","Desc","{","a b c","}"]},
{"rec":"x 'unterminated","strip":false,"quoted":true,"tokens":["x","unterminated\n"]},
{"rec":"x 'unterminated","strip":true,"quoted":true,"tokens":["x","unterminated\n"]},
{"rec":"  tab\there{nested}{ } ","strip":false,"quoted":false,"tokens":["tab","here","{","nested","}","{","}"]},
{"rec":"  tab\there{nested}{ } ","strip":true,"quoted":false,"tokens":["tab","here","{","nested","}","{","}"]},
{"rec":"a#b 'c#d' e","strip":false,"quoted":false,"tokens":["a","#b 'c#d' e"]},
{"rec":"a#b 'c#d' e","strip":true,"quoted":false,"tokens":["a"]},
{"rec":"Q1 Name { 'it''s' }","strip":false,"quoted":false,"tokens":["Q1","Name","{","it","s","}"]},
{"rec":"Q1 Name { 'it''s' }","strip":true,"quoted":false,"tokens":["Q1","Name","{","it","s","}"]},
{"rec":"S1 Exp { '[Q1].x > 0' } # c1 # c2","strip":false,"quoted":false,"tokens":["S1","Exp","{","[Q1].x > 0","}","# c1 # c2"]},
{"rec":"S1 Exp { '[Q1].x > 0' } # c1 # c2","strip":true,"quoted":false,"tokens":["S1","Exp","{","[Q1].x > 0","}"]},
{"rec":"","strip":false,"quoted":false,"tokens":[]},
{"rec":"","strip":true,"quoted":false,"tokens":[]},
{"rec":"'","strip":false,"quoted":true,"tokens":["\n"]},
{"rec":"'","strip":true,"quoted":true,"tokens":["\n"]},
{"rec":"{{}}","strip":false,"quoted":false,"tokens":["{","{","}","}"]},
{"rec":"{{}}","strip":true,"quoted":false,"tokens":["{","{","}","}"]},
{"rec":"\u65e5\u672c\u8a9e '\u3053\u3093\u306b\u3061\u306f \u4e16\u754c'","strip":false,"quoted":false,"tokens":["\u65e5\u672c\u8a9e","\u3053\u3093\u306b\u3061\u306f \u4e16\u754c"]},
{"rec":"\u65e5\u672c\u8a9e '\u3053\u3093\u306b\u3061\u306f \u4e16\u754c'","strip":true,"quoted":false,"tokens":["\u65e5\u672c\u8a9e","\u3053\u3093\u306b\u3061\u306f \u4e16\u754c"]},
{"multi":true,"tokens":["S1","Desc","{","line one\nline two\nend","x","}"],"quotedStates":[true, true, false]},
{"quote":"abc","needs":false,"isq":false,"add":"abc"},
{"quote":"a b","needs":true,"isq":false,"add":"'a b'"},
{"quote":"{x}","needs":true,"isq":false,"add":"'{x}'"},
{"quote":"'q'","needs":false,"isq":true,"add":"'q'"},
{"quote":"a#b","needs":true,"isq":false,"add":"'a#b'"},
{"quote":"\"x\"","needs":true,"isq":false,"add":"'\"x\"'"},
{"quote":"","needs":false,"isq":false,"add":""},
{"sub":"{ a b } { c }","split":["a b","c"],"addsub":"{ 'a b' } { c }","defs":"{ a  b } { c }"},
{"sub":"{ 1 2 }{3 4}","split":["1 2","3 4"],"addsub":"{ '1 2' } { '3 4' }","defs":"{ 1  2 } { 3  4 }"},
{"sub":"x y","split":["x y"],"addsub":"{ 'x y' }","defs":"{ x  y }"},
{"sub":"{ AAA 1 } { bbb '2 + 3' [s] TimeUnit } { c }","split":["AAA 1","bbb '2 + 3' [s] TimeUnit","c"],"addsub":"{ 'AAA 1' } { 'bbb '2 + 3' [s] TimeUnit' } { c }","defs":"{ AAA  1 } { bbb  '2 + 3' [s]'  TimeUnit } { c }"},
{"enc":"[m]","rem":"m","add":"[m]"},
{"enc":"m","rem":"m","add":"[m]"},
{"enc":"[m","rem":"m","add":"[m]"},
{"enc":"m]","rem":"m","add":"[m]"},
{"enc":"[]","rem":"","add":"[]"}];

test("tokenize は Java と同じに字句を分ける", () => {
	for (const r of REF.filter(x => "rec" in x)) {
		const toks: string[] = [];
		const q = Parser.tokenize(toks, r.rec as string, r.strip as boolean);
		assert.deepEqual(toks, r.tokens, `rec=${JSON.stringify(r.rec)} strip=${r.strip}`);
		assert.equal(q, r.quoted, `rec=${JSON.stringify(r.rec)}（引用の中で終わったか）`);
	}
});

test("tokenize は複数の行にまたがる引用をつなぐ", () => {
	const r = REF.find(x => "multi" in x)!;
	const toks: string[] = [];
	let q = false;
	const qs: boolean[] = [];
	for (const l of ["S1 Desc { 'line one", "line two", "end' x }"]) {
		q = Parser.tokenize(toks, l, q, true);
		qs.push(q);
	}
	assert.deepEqual(toks, r.tokens);
	assert.deepEqual(qs, r.quotedStates);
});

test("needsQuoting・isQuoted・addQuotesIfNeeded", () => {
	for (const r of REF.filter(x => "quote" in x)) {
		const s = r.quote as string;
		assert.equal(Parser.needsQuoting(s), r.needs, s);
		assert.equal(Parser.isQuoted(s), r.isq, s);
		assert.equal(Parser.addQuotesIfNeeded(s), r.add, s);
	}
});

test("splitSubstrings・addSubstringQuotesIfNeeded・addQuotesIfNeededToDefinitions", () => {
	for (const r of REF.filter(x => "sub" in x)) {
		const s = r.sub as string;
		assert.deepEqual(Parser.splitSubstrings(s), r.split, s);
		assert.equal(Parser.addSubstringQuotesIfNeeded(s), r.addsub, s);
		assert.equal(Parser.addQuotesIfNeededToDefinitions(s), r.defs, s);
	}
});

test("removeEnclosure・addEnclosure", () => {
	for (const r of REF.filter(x => "enc" in x)) {
		const s = r.enc as string;
		assert.equal(Parser.removeEnclosure("[", s, "]"), r.rem, s);
		assert.equal(Parser.addEnclosure("[", s, "]"), r.add, s);
	}
});

test("jsplit は Java の String.split と同じ（末尾の空を除く・limit）", () => {
	assert.deepEqual(jsplit("a:b::", ":"), ["a", "b"]);
	assert.deepEqual(jsplit(":a:b", ":"), ["", "a", "b"]);
	assert.deepEqual(jsplit("", ":"), [""]);
	assert.deepEqual(jsplit("abc", ":"), ["abc"]);
	assert.deepEqual(jsplit("a  b c", "\\s+", 2), ["a", "b c"]);
	assert.deepEqual(jsplit("a b ", "\\s+", 2), ["a", "b "]);
	assert.deepEqual(jsplit("a.b.c", "\\."), ["a", "b", "c"]);
});

test("jtrim は Java の String.trim と同じ（制御文字も除き、全角の空白は残す）", () => {
	assert.equal(jtrim("\u0001 a b\t\n"), "a b");
	assert.equal(jtrim("\u3000a\u3000"), "\u3000a\u3000");
});
