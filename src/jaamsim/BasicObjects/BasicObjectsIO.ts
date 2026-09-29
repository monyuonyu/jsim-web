/*
 * BasicObjects の部品が使う、ファイルと外部プログラムの読み書き（Java に対応するファイルは無い）。
 * Copyright (C) 2026 shota
 * Licensed under the Apache License, Version 2.0
 *
 * Java 版は java.io.File・ProcessBuilder をそのまま使っている。TS では、後でブラウザでも動かせるように、
 * 読み書きの関数をここに集めて差し替えられるようにした（setBasicObjectsIO）。
 * 既定は Node.js の fs・child_process を使う（静的な import はせず、process.getBuiltinModule で取る。
 * ブラウザでは使えないので、差し替えるまで「使えない」という誤りになる）。
 *
 * 使う所:
 * - Logger: 古い .log ファイルがあれば消す（fileExists・deleteFile）
 * - ExternalProgram: 外部プログラムを 1 回走らせて、標準出力と標準エラーを受け取る（runProgram）
 * - ExternalProgramServer: 外部プログラムを立ち上げたままにして、1 行ずつやり取りする（startServerProcess）
 */

/** 立ち上げたままの外部プログラム（ExternalProgramServer が使う） */
export interface ExternalServerProcess {
	/** 1 行を書いて、すぐに送る（Java の BufferedWriter.write と flush） */
	writeLine(line: string): void;
	/** 1 行を読む。終わりなら null（Java の BufferedReader.readLine。届くまで待つ） */
	readLine(): string | null;
	/** 止める（Java の Process.destroy） */
	destroy(): void;
}

export interface BasicObjectsIO {
	/** ファイルがあるか（Java の File.exists） */
	fileExists(path: string): boolean;
	/** ファイルを消す。消せたら true（Java の File.delete） */
	deleteFile(path: string): boolean;
	/**
	 * 外部プログラムを走らせ、終わるまで待って、標準出力と標準エラーを返す。
	 * timeoutMs は Java の Process.waitFor(timeout) に渡す値。Java 版は待ち時間が過ぎても止めず、
	 * その後の読み取りで終わるまで待つので、既定の実装も止めない（受け取るだけ）。
	 */
	runProgram(command: string[], timeoutMs: number): { stdout: string; stderr: string };
	/**
	 * 外部プログラムを立ち上げたままにする。標準エラーに出た行は、1 行ずつ onErrorLine に渡す
	 * （Java 版は別のスレッドで読んで Log に書く）。
	 */
	startServerProcess(command: string[], onErrorLine: (line: string) => void): ExternalServerProcess;
}

type NodeProcess = { getBuiltinModule?: (id: string) => unknown };

function nodeModule<T>(id: string): T {
	const proc = (globalThis as { process?: NodeProcess }).process;
	const mod = proc?.getBuiltinModule?.(id);
	if (mod === undefined)
		throw new Error(`${id} is not available in this environment`);
	return mod as T;
}

/** 既定（Node.js） */
const nodeIO: BasicObjectsIO = {
	fileExists(path: string): boolean {
		const fs = nodeModule<typeof import("node:fs")>("node:fs");
		return fs.existsSync(path);
	},

	deleteFile(path: string): boolean {
		const fs = nodeModule<typeof import("node:fs")>("node:fs");
		try {
			fs.unlinkSync(path);
			return true;
		}
		catch {
			return false;
		}
	},

	runProgram(command: string[], timeoutMs: number): { stdout: string; stderr: string } {
		const cp = nodeModule<typeof import("node:child_process")>("node:child_process");
		const res = cp.spawnSync(command[0], command.slice(1), { encoding: "utf8" });
		if (res.error)
			throw res.error;
		return { stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
	},

	startServerProcess(command: string[], onErrorLine: (line: string) => void): ExternalServerProcess {
		// TODO(移植): 立ち上げたままのプログラムと、同期で 1 行ずつやり取りする仕組みが Node.js には無い
		// （Worker と Atomics.wait を使えば作れる）。今は使えないという誤りにする。
		throw new Error("ExternalProgramServer is not supported in this environment");
	},
};

let current: BasicObjectsIO = nodeIO;

/** 読み書きの関数を差し替える（ブラウザ・試験用） */
export function setBasicObjectsIO(io: BasicObjectsIO): void {
	current = io;
}

export function getBasicObjectsIO(): BasicObjectsIO {
	return current;
}

/**
 * Java の BufferedReader.readLine を繰り返したのと同じ分け方で、文字列を行に分ける
 * （\n・\r・\r\n で区切る。最後が改行で終わるときは、その後の空の行は作らない）。
 */
export function splitLines(s: string): string[] {
	if (s === "")
		return [];
	const lines = s.split(/\r\n|\r|\n/);
	if (/(\r\n|\r|\n)$/.test(s))
		lines.pop();
	return lines;
}

/**
 * FileInput の値（Java では URI）をファイルの道筋にする（Java の new File(uri).getPath() と uri.getPath()）。
 * 文字列・URL・getPath() を持つもの のどれでもよい。
 */
export function uriToPath(uri: unknown): string {
	if (typeof uri === "string") {
		if (uri.startsWith("file:"))
			return decodeURIComponent(new URL(uri).pathname);
		return uri;
	}
	if (uri instanceof URL)
		return decodeURIComponent(uri.pathname);
	const g = (uri as { getPath?: () => string } | null)?.getPath;
	if (typeof g === "function")
		return g.call(uri);
	return String(uri);
}
