// 事象の順番が Java 版と同じ規則になること: 時刻 → 優先度 → FIFO は後ろへ・LIFO は前へ
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventManager, EventHandle, ProcessTarget } from "../src/core/events/EventManager.ts";

class Rec extends ProcessTarget {
	constructor(private log: string[], private name: string, private then?: () => void) { super(); }
	getDescription() { return this.name; }
	process() { this.log.push(`${EventManager.simTicks()}:${this.name}`); this.then?.(); }
}

test("時刻・優先度・FIFO/LIFO の順に実行する", () => {
	const em = new EventManager("t");
	const log: string[] = [];
	em.scheduleProcessExternal(0, 0, true, new Rec(log, "開始", () => {
		EventManager.scheduleTicks(10, 5, true, new Rec(log, "A"), null);
		EventManager.scheduleTicks(10, 5, true, new Rec(log, "B"), null);   // A の後ろ
		EventManager.scheduleTicks(10, 5, false, new Rec(log, "C"), null);  // 先頭へ
		EventManager.scheduleTicks(10, 1, true, new Rec(log, "D"), null);   // 優先度が高い
		EventManager.scheduleTicks(5, 9, true, new Rec(log, "E"), null);    // 時刻が早い
	}), null);
	em.resumeTicks(Number.MAX_SAFE_INTEGER);
	assert.deepEqual(log, ["0:開始", "5:E", "10:D", "10:C", "10:A", "10:B"]);
});

test("取り消し（killEvent）と前倒し（interruptEvent）", () => {
	const em = new EventManager("t");
	const log: string[] = [];
	const h1 = new EventHandle(), h2 = new EventHandle();
	em.scheduleProcessExternal(0, 0, true, new Rec(log, "開始", () => {
		EventManager.scheduleTicks(100, 5, true, new Rec(log, "消す"), h1);
		EventManager.scheduleTicks(100, 5, true, new Rec(log, "前倒し"), h2);
		EventManager.scheduleTicks(50, 5, true, new Rec(log, "中間", () => {
			EventManager.killEvent(h1);
			EventManager.interruptEvent(h2);
		}), null);
	}), null);
	em.resumeTicks(Number.MAX_SAFE_INTEGER);
	assert.deepEqual(log, ["0:開始", "50:中間", "50:前倒し"]);
	assert.equal(h1.isScheduled(), false);
});

test("条件つきの事象は、時刻を進める前に調べる", () => {
	const em = new EventManager("t");
	const log: string[] = [];
	let flag = false;
	em.scheduleProcessExternal(0, 0, true, new Rec(log, "開始", () => {
		EventManager.scheduleUntil(new Rec(log, "条件"), { evaluate: () => flag }, null);
		EventManager.scheduleTicks(20, 5, true, new Rec(log, "旗", () => { flag = true; }), null);
		EventManager.scheduleTicks(30, 5, true, new Rec(log, "後"), null);
	}), null);
	em.resumeTicks(Number.MAX_SAFE_INTEGER);
	assert.deepEqual(log, ["0:開始", "20:旗", "20:条件", "30:後"]);
});

test("目標の時刻で止まり、続きから再開できる", () => {
	const em = new EventManager("t");
	const log: string[] = [];
	for (const t of [10, 20, 30])
		em.scheduleProcessExternal(t, 5, true, new Rec(log, String(t)), null);
	em.resumeTicks(25);
	assert.deepEqual(log, ["10:10", "20:20"]);
	assert.equal(em.getTicks(), 25);
	em.resumeTicks(Number.MAX_SAFE_INTEGER);
	assert.deepEqual(log, ["10:10", "20:20", "30:30"]);
});
