/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2022 JaamSim Software Inc.
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
 *
 * TypeScript への移植 (C) 2026 shota
 */
// 注: Java の 4 つのコンストラクタを 1 つにまとめ、最初の引数で見分ける:
//   new InputErrorException(pos: number, src, msg[, cause])  … 位置つき
//   new InputErrorException(e: ExpError)                     … 式の誤りから
//   new InputErrorException(format, ...args)                 … String.format と同じ（jformat）
// 利用者に見せる文なので、書式は呼ぶ側で tr(...) に包んでから渡す（PORTING.md の 10）。
// double を %s で渡すときは、呼ぶ側で jstr にしておく。
import { jformat } from "../internal.ts";
import { ExpError } from "../internal.ts";

/**
 * Custom exception thrown when an error due to bad input is encountered.
 */
export class InputErrorException extends Error {

	source: string | null;
	position: number;
	private readonly javaMessage: string | null;

	constructor(pos: number, src: string | null, msg: string | null, cause?: unknown);
	constructor(e: ExpError);
	constructor(format: string, ...args: unknown[]);
	constructor(a: number | string | ExpError, ...rest: unknown[]) {
		let pos: number;
		let src: string | null;
		let msg: string | null;
		let cause: unknown = null;
		if (typeof a === "number") {
			pos = a;
			src = rest[0] as string | null;
			msg = rest[1] as string | null;
			cause = rest.length > 2 ? rest[2] : null;
		}
		else if (a instanceof ExpError) {
			pos = a.pos;
			src = a.source;
			msg = a.getMessage();
			cause = a;
		}
		else {
			pos = -1;
			src = "";
			msg = jformat(a, ...rest);
		}
		super(msg ?? "", cause !== null && cause !== undefined ? { cause } : undefined);
		this.name = "InputErrorException";
		this.source = src;
		this.position = pos;
		this.javaMessage = msg;
	}

	/** Java の getMessage()（null のこともある） */
	getMessage(): string | null {
		return this.javaMessage;
	}

	/** Java の getCause() */
	getCause(): unknown {
		return (this as { cause?: unknown }).cause ?? null;
	}

}
