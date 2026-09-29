/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2023 JaamSim Software Inc.
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
import { tr } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { ErrorException } from "../internal.ts";
import { EventTraceRecord } from "../internal.ts";
import { FileSystem } from "../internal.ts";

/**
 * Java の BufferedWriter の代わりに、FileSystem.backend に書く（FileEntity.ts）。
 */
export class EventRecorder implements EventTraceListener {
	private readonly fileName: string;
	private readonly trcRecord = new EventTraceRecord();

	constructor(fileName: string) {
		this.fileName = fileName;
		try {
			FileSystem.backend.createNewFile(fileName);
			FileSystem.backend.write(fileName, "", false);
		}
		catch (e) {
			throw new InputErrorException(tr("IOException thrown trying to open event recording file:%n%s"),
					ErrorException.messageOf(e));
		}
	}

	private finish(): void {
		if(this.trcRecord.traceLevel !== 0)
			return;

		this.trcRecord.add("");
		let text = "";
		for (const each of this.trcRecord) {
			text += each + "\n";  // TODO(移植): Java の newLine は OS の改行
		}
		try {
			FileSystem.backend.write(this.fileName, text, true);
		}
		catch (ioe) { /* Java も捨てる */ }

		this.trcRecord.clear();
	}

	traceEvent(tick: number, priority: number, t: ProcessTarget): void {
		// Don't write anything if not at level 0
		if (this.trcRecord.traceLevel !== 0)
			throw new ErrorException("Tracing started incorrectly");

		this.trcRecord.traceEvent(tick, priority, t);
	}

	traceInterrupt(tick: number, priority: number, t: ProcessTarget): void {
		this.trcRecord.traceInterrupt(tick, priority, t);
	}

	traceProcessStart(t: ProcessTarget): void {
		this.trcRecord.traceProcessStart(t);
	}

	traceProcessEnd(): void {
		this.trcRecord.traceProcessEnd();
		this.finish();
	}

	traceWait(tick: number, priority: number, t: ProcessTarget): void {
		this.trcRecord.traceWait(tick, priority, t);
		this.finish();
	}

	traceWaitUntil(): void {
		this.trcRecord.traceWaitUntil();
		this.finish();
	}

	traceSchedUntil(t: ProcessTarget): void {
		this.trcRecord.traceSchedUntil(t);
	}

	traceSchedProcess(tick: number, priority: number, t: ProcessTarget): void {
		this.trcRecord.traceSchedProcess(tick, priority, t);
	}

	traceKill(tick: number, priority: number, t: ProcessTarget): void {
		this.trcRecord.traceKill(tick, priority, t);
	}

	traceConditionalEval(_t: ProcessTarget): void {
		//FIXME: fix conditonal tracing
		//trcRecord.traceConditionalEval(t);
	}

	traceConditionalEvalEnded(_wakeup: boolean, _t: ProcessTarget): void {
		//FIXME: fix conditonal tracing
		//trcRecord.traceConditionalEvalEnded(wakeup, t);
	}

}
