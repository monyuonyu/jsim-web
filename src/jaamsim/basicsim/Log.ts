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
