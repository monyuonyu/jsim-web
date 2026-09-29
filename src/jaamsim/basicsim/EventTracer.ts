/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021-2023 JaamSim Software Inc.
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
import { EventManager } from "../internal.ts";
import type { EventTraceListener } from "../events/EventTraceListener.ts";
import type { ProcessTarget } from "../events/ProcessTarget.ts";
import { tr } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { EventTraceRecord } from "../internal.ts";
import { FileSystem } from "../internal.ts";
import { Log } from "../internal.ts";

/**
 * Java の BufferedReader の代わりに、FileSystem.backend から全部を読み、行に分けて 1 行ずつ返す。
 * GUIFrame を呼ぶ所は、今の JaamSimModel の GUIListener が無いので呼べない（下の TODO）。
 */
export class EventTracer implements EventTraceListener {
	private readonly eventVerifyLines: string[];
	private lineIdx = 0;
	private readonly reader: EventTraceRecord;
	private bufferTime: number; // Internal sim time buffer has been filled to
	private readonly eventBuffer: EventTraceRecord[];

	constructor(evtName: string) {
		this.eventBuffer = [];
		this.bufferTime = 0;
		const text = FileSystem.backend.readText(evtName);
		if (text == null)
			throw new InputErrorException(tr("Unable to open the event verification file:%n%s"), evtName);
		this.eventVerifyLines = splitLines(text);

		this.reader = new EventTraceRecord();
	}

	private readLine(): string | null {
		if (this.lineIdx >= this.eventVerifyLines.length)
			return null;
		return this.eventVerifyLines[this.lineIdx++];
	}

	private fillBufferUntil(internalTime: number): void {
		while (this.bufferTime <= internalTime) {
			// Read a full trace record form the file, terminated at a blank line
			const temp = new EventTraceRecord();
			while (true) {
				const line = this.readLine();

				if (line == null)
					break;

				temp.add(line);

				if (line.length === 0)
					break;
			}

			if (temp.size() === 0)
				break;

			// Parse the key information from the record
			temp.parse();
			if (temp.getInternalTime() > this.bufferTime) {
				this.bufferTime = temp.getInternalTime();
			}
			this.eventBuffer.push(temp);
		}
	}

	private findEventInBuffer(record: EventTraceRecord): void {
		// Ensure we have read enough from the log to find this record
		this.fillBufferUntil(record.getInternalTime());

		// Try an optimistic approach first looking for exact matches
		for (const each of this.eventBuffer) {
			if (!each.basicCompare(record)) {
				continue;
			}

			for (let i = 0; i < record.size(); i++) {
				if (record.get(i) !== each.get(i)) {
					let sb = "";
					sb += "Present event;\n";
					sb += record.get(i) + "\n";

					sb += "\n";
					sb += "Next event in the trace file:\n";
					sb += each.get(i) + "\n";

					sb += "\n";
					sb += "List of events at the present time:\n";
					for (const line of record) {
						sb += line + "\n";
					}

					sb += "List of events at the present time in the trace file:\n";
					for (const line of each) {
						sb += line + "\n";
					}

					const msg = sb;
					console.log(msg);
					Log.logLine(msg);
					EventManager.current().pause();

					// TODO(移植): Java は GUIFrame があれば、RunManager を止め、誤りの窓
					// （"Event Verification Error" / "Present event does not match the next event at this time in the trace file."）を出す。
					// ここからは GUIListener に届かないので出していない。
					break;
				}
			}

			// Found the event, it compared OK, remove from the buffer
			const idx = this.eventBuffer.indexOf(each);
			this.eventBuffer.splice(idx, 1);
			//System.out.println("Buffersize:" + eventBuffer.size());
			return;
		}

		let sb = "";
		sb += "Present event:\n";
		for (const line of record) {
			sb += line + "\n";
		}
		sb += "Next events in the trace file:\n";
		for (const rec of this.eventBuffer) {
			for (const line of rec) {
				sb += line + "\n";
			}
		}

		const msg = sb;
		console.log(msg);
		Log.logLine(msg);
		EventManager.current().pause();

		// TODO(移植): Java は GUIFrame があれば、RunManager を止め、誤りの窓
		// （"Event Verification Error" / "Present event has no matching event at this time in the trace file."）を出す。
	}

	private finish(): void {
		if (this.reader.traceLevel !== 0)
			return;

		this.reader.add("");
		this.reader.parse();
		this.findEventInBuffer(this.reader);
		this.reader.clear();
	}

	traceWait(tick: number, priority: number, t: ProcessTarget): void {
		this.reader.traceWait(tick, priority, t);
		this.finish();
	}

	traceEvent(tick: number, priority: number, t: ProcessTarget): void {
		this.reader.traceEvent(tick, priority, t);
	}

	traceSchedProcess(tick: number, priority: number, t: ProcessTarget): void {
		this.reader.traceSchedProcess(tick, priority, t);
	}

	traceProcessStart(t: ProcessTarget): void {
		this.reader.traceProcessStart(t);
	}

	traceProcessEnd(): void {
		this.reader.traceProcessEnd();
		this.finish();
	}

	traceInterrupt(tick: number, priority: number, t: ProcessTarget): void {
		this.reader.traceInterrupt(tick, priority, t);
	}

	traceKill(tick: number, priority: number, t: ProcessTarget): void {
		this.reader.traceKill(tick, priority, t);
	}

	traceWaitUntil(): void {
		this.reader.traceWaitUntil();
		this.finish();
	}

	traceSchedUntil(t: ProcessTarget): void {
		this.reader.traceSchedUntil(t);
	}

	traceConditionalEval(_t: ProcessTarget): void {}

	traceConditionalEvalEnded(_wakeup: boolean, _t: ProcessTarget): void {
		//FIXME: disable conditional tracing under the event recorder is also fixed
		//if (!wakeup)
		//	return;
		//reader.traceConditionalEvalEnded(wakeup, t);
		//this.finish(EventManager.current());
	}

}

/** BufferedReader.readLine と同じ区切り（\n、\r、\r\n）で行に分ける。最後の改行の後の空の行は数えない */
function splitLines(text: string): string[] {
	const ret = text.split(/\r\n|\r|\n/);
	if (ret.length > 0 && ret[ret.length - 1] === "")
		ret.pop();
	return ret;
}
