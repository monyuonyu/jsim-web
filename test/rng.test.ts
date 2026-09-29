// 乱数が Java 版と 1 ビットも違わないこと（正解は ref/RngRef.java で作った test/rng.ref.txt）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MRG1999a } from "../src/core/rng/MRG1999a.ts";

function bits(x: number): string {
	const v = new DataView(new ArrayBuffer(8));
	v.setFloat64(0, x);
	return v.getBigUint64(0).toString(16);
}

test("MRG1999a は Java 版と同じ数の列を出す", () => {
	const lines = readFileSync(new URL("./rng.ref.txt", import.meta.url), "utf8").trim().split("\n");
	assert.ok(lines.length >= 7);
	for (const line of lines) {
		const [stream, sub, ...want] = line.split(" ");
		const r = new MRG1999a(Number(stream), Number(sub));
		const got = want.map(() => bits(r.nextUniform()));
		assert.deepEqual(got, want, `流れ ${stream}・部分流 ${sub}`);
	}
});
