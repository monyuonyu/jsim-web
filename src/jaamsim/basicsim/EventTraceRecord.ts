/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2009-2011 Ausenco Engineering Canada Inc.
 * TypeScript への移植 (C) 2026 shota
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { EventTraceListener } from "../events/EventTraceListener.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";
import { jformat } from "../internal.ts";
import { ErrorException } from "../internal.ts";

/**
 * Java は ArrayList<String> を継承している。TS では配列を中に持ち、使う関数（add, get, size, clear, 繰り返し）を持たせた。
 */
export class EventTraceRecord implements EventTraceListener, Iterable<string> {
	private readonly lines: string[] = [];
	private internalTime = 0;
	private targetName: string | null = null;
	traceLevel: number;

	constructor() {
		this.traceLevel = 0;
	}

	// ---- ArrayList<String> の代わり ----
	add(s: string): boolean {
		this.lines.push(s);
		return true;
	}
	get(i: number): string {
		return this.lines[i];
	}
	size(): number {
		return this.lines.length;
	}
	clear(): void {
		this.lines.length = 0;
	}
	[Symbol.iterator](): Iterator<string> {
		return this.lines[Symbol.iterator]();
	}

	parse(): void {
		// The first line of the trace is always Event\ttime
		const temp = this.get(0).split("\t");
		this.internalTime = parseJavaLong(temp[1]);

		// A regular event wakeup, parse target/method
		if (temp[0] === "Event") {
			this.targetName = temp[3];
			return;
		}

		throw new ErrorException("All events must start with an event record");
	}

	private append(record: string): void {
		let rec = "";

		for (let i = 0; i < this.traceLevel; i++) {
			rec += "\t";
		}
		rec += record;
		this.add(rec);
	}

	traceWait(tick: number, priority: number, _t: ProcessTarget): void {
		this.traceLevel--;
		this.append(jformat("Wait\t%d\t%d\t%s", tick, priority, EventTraceRecord.getWaitDescription()));
	}

	traceEvent(tick: number, priority: number, t: ProcessTarget): void {
		this.append(jformat("Event\t%d\t%d\t%s", tick, priority, t.getDescription()));
		this.traceLevel++;
	}

	traceInterrupt(tick: number, priority: number, t: ProcessTarget): void {
		this.append(jformat("Int\t%d\t%d\t%s", tick, priority, t.getDescription()));
		this.traceLevel++;
	}

	traceKill(tick: number, priority: number, t: ProcessTarget): void {
		this.append(jformat("Kill\t%d\t%d\t%s", tick, priority, t.getDescription()));
	}

	traceWaitUntil(): void {
		this.traceLevel--;
		this.append("WaitUntil");
	}

	traceSchedUntil(t: ProcessTarget): void {
		this.append(jformat("SchedUntil\t%s", t.getDescription()));
	}

	traceProcessStart(t: ProcessTarget): void {
		this.append(jformat("StartProcess\t%s", t.getDescription()));
		this.traceLevel++;
	}

	traceProcessEnd(): void {
		this.traceLevel--;
		this.append("Exit");
	}

	traceSchedProcess(tick: number, priority: number, t: ProcessTarget): void {
		this.append(jformat("SchedProcess\t%d\t%d\t%s", tick, priority, t.getDescription()));
	}

	traceConditionalEval(_t: ProcessTarget): void {}

	traceConditionalEvalEnded(_wakeup: boolean, _t: ProcessTarget): void {
		//if (!wakeup)
		//	return;
		//EventManager e = EventManager.current();
		//this.addHeader(e.name, e.getTicks());
		//this.append(String.format("WaitUntilEnded\t%s", t.getDescription()));
	}

	getInternalTime(): number {
		return this.internalTime;
	}

	/**
	 * Does a superficial comparison of two records, check number of entries,
	 * time/target/method and finally the basic contents of the record.
	 */
	basicCompare(record: EventTraceRecord): boolean {
		if (record.size() !== this.size())
			return false;

		if (record.internalTime !== this.internalTime)
			return false;

		if (record.targetName !== this.targetName)
			return false;

		return true;
	}

	/**
	 * Java は呼び出しのスタックをたどって、待った関数の「クラス名:関数名」を返す。
	 * TODO(移植): スレッドで待つ書き方（waitTicks など）は無いので呼ばれない前提。スタックはたどらず "unknown:unknown" を返す。
	 */
	static getWaitDescription(): string {
		return jformat("%s:%s", "unknown", "unknown");
	}
}

/** Java の Long.parseLong（数でなければ NumberFormatException の代わりに誤り） */
function parseJavaLong(s: string | undefined): number {
	if (s === undefined || !/^[+-]?\d+$/.test(s))
		throw new Error(`For input string: "${s}"`);
	return Number(s);
}
