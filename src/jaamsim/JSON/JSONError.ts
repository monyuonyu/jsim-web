/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2022 JaamSim Software Inc.
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

// 2 つのコンストラクタ (source, pos, msg)・(source, pos, fmt, args...) は、後ろの引数の有無で見分ける 1 つのコンストラクタにした。
// 書式の文は、呼ぶ側で tr() に包んで渡す。

import { jformat } from "../java/lang.ts";

export class JSONError extends Error {
	public readonly source: string | null;
	public readonly pos: number;

	constructor(source: string | null, pos: number, msg: string, ...args: unknown[]) {
		super(args.length > 0 ? jformat(msg, ...args) : msg);
		this.source = source;
		this.pos = pos;
	}

}
