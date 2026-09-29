// 数を文字列にする関数が Java と同じ結果になること（正解は ref/FmtRef.java で作った test/fmt.ref.txt）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jstr, jformat } from "../src/jaamsim/java/lang.ts";

const fmts = ["%s", "%.2f", "%.3f", "%f", "%.0f", "%e", "%.3e", "%g", "%.4g", "%10.2f", "%-10.2f|", "%,.2f", "%010.3f", "%+.1f"];

function fromBits(hex: string): number {
	const v = new DataView(new ArrayBuffer(8));
	v.setBigUint64(0, BigInt("0x" + hex));
	return v.getFloat64(0);
}

test("jstr と jformat は Java と同じ", () => {
	const lines = readFileSync(new URL("./fmt.ref.txt", import.meta.url), "utf8").trimEnd().split("\n");
	const bad: string[] = [];
	for (const line of lines) {
		const cols = line.split("\t");
		if (cols[0] === "D") {
			const n = Number(cols[1]);
			const got = jformat("%d|%,d|%8d|%-8d|%08d|%+d", n, n, n, n, n, n);
			if (got !== cols[2]) bad.push(`${cols[1]} %d…: 正解 "${cols[2]}" / 今 "${got}"`);
			continue;
		}
		const x = fromBits(cols[0]);
		if (jstr(x) !== cols[1]) bad.push(`${cols[1]} jstr: 今 "${jstr(x)}"`);
		fmts.forEach((f, i) => {
			const got = f === "%s" ? jformat(f, jstr(x)) : jformat(f, x);
			if (got !== cols[i + 2]) bad.push(`${cols[1]} ${f}: 正解 "${cols[i + 2]}" / 今 "${got}"`);
		});
	}
	assert.deepEqual(bad, []);
});
