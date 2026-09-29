/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2025 Harvey Harrison
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
import { jformat } from "../java/lang.ts";
import type { LogListener } from "./LogListener.ts";

/**
 * Simple logger for global log not tied to any particular model.
 */
export class Log {
	private static readonly log: string[] = [];
	private static readonly listeners: LogListener[] = [];

	static addListener(listen: LogListener): void {
		Log.listeners.push(listen);
	}

	static format(format: string, ...args: unknown[]): void {
		Log.logLine(jformat(format, ...args));
	}

	static logLine(line: string): void {
		Log.log.push(line);
		for (const each of Log.listeners)
			each.update();
	}

	static logException(ex: unknown): void {
		// Java の printStackTrace の代わりに、JavaScript のスタックの文字列を使う
		let stackTrace: string;
		if (ex instanceof Error)
			stackTrace = ex.stack ?? String(ex);
		else
			stackTrace = String(ex);
		Log.logLine(stackTrace);

		console.error(stackTrace);
	}

	static getLog(fromIdx: number): string[] {
		const ret: string[] = [];
		for (let i = fromIdx; i < Log.log.length; i++) {
			ret.push(Log.log[i]);
		}
		return ret;
	}
}
