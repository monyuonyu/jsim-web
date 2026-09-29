/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
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

// Java の interface は、TS の interface と同じ名前の const の組にした（Linkable.ts と同じ作り）。
// `QueueUser.register(クラス)` で印を付け、`x instanceof QueueUser` で判定する
// （JaamSimModel.getClonesOfIterator(Entity, QueueUser) のように、クラスの代わりに渡してもよい）。

import type { JClass } from "../java/lang.ts";
import type { Queue } from "./Queue.ts";

const MARK = Symbol("QueueUser");

export interface QueueUser {

	/**
	 * Returns a list of the Queues used by this object.
	 * @return the Queue list.
	 */
	getQueues(): Queue[];

	/**
	 * Called whenever an entity is added to one of the Queues used
	 * by this object.
	 */
	queueChanged(): void;
}

export const QueueUser = {
	/** Java の完全な名前（InterfaceEntityInput などに渡すため。JInterface の形） */
	javaName: "com.jaamsim.ProcessFlow.QueueUser",

	isInstance(o: unknown): o is QueueUser {
		return o instanceof (QueueUser as unknown as JClass);
	},

	/** Java の「implements QueueUser」の代わり */
	register(cls: JClass): void {
		(cls.prototype as Record<symbol, unknown>)[MARK] = true;
	},

	[Symbol.hasInstance](o: unknown): o is QueueUser {
		return o !== null && typeof o === "object" && (o as Record<symbol, unknown>)[MARK] === true;
	},
};

/** x instanceof QueueUser の代わり（関数の形。ほかの担当の書き方に合わせたもの。中身は `x instanceof QueueUser` と同じ） */
export function isQueueUser(o: unknown): o is QueueUser {
	return o instanceof QueueUser;
}
