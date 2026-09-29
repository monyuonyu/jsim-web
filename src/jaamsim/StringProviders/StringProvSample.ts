/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2015 Ausenco Engineering Canada Inc.
 * Copyright (C) 2017-2022 JaamSim Software Inc.
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

// getNextString の多重定義は、引数の数と 3 つ目の引数の型で見分ける（StringProvider.ts を参照）。

import type { Entity } from "../basicsim/Entity.ts";
import type { SampleProvider } from "../Samples/SampleProvider.ts";
import { jformat, jstr } from "../internal.ts";
import type { StringProvider } from "./StringProvider.ts";

/** Java の (int) x（0 の方向へ切り捨て、範囲外は端に張り付き、NaN は 0、-0 は 0） */
function toInt(x: number): number {
	if (Number.isNaN(x)) return 0;
	if (x >= 2147483647) return 2147483647;
	if (x <= -2147483648) return -2147483648;
	return Math.trunc(x) | 0;
}

/**
 * 利用者が書いた書式（fmt）に Java の double を渡すための箱。
 * %s では Java の Double.toString（jstr）の形、%f・%e・%g では数として使われる。
 * （TS では int と double を見分けられないので、jformat が %s で "1" にしてしまうのを防ぐ）
 */
function boxDouble(x: number): { valueOf(): number; toString(): string } {
	return { valueOf: () => x, toString: () => jstr(x) };
}

export class StringProvSample implements StringProvider {
	private readonly samp: SampleProvider;

	constructor(s: SampleProvider) {
		this.samp = s;
	}

	getNextString(thisEnt: Entity | null, simTime: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, siFactor: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, siFactor: number, integerValue: boolean): string;
	getNextString(thisEnt: Entity | null, simTime: number, fmt: string, siFactor: number): string;
	getNextString(thisEnt: Entity | null, simTime: number, a?: number | string, b?: number | boolean): string {

		// getNextString(Entity thisEnt, double simTime)
		if (a === undefined) {
			return jstr(this.samp.getNextSample(thisEnt as Entity, simTime));
		}

		// getNextString(Entity thisEnt, double simTime, String fmt, double siFactor)
		if (typeof a === "string") {
			const fmt = a;
			const siFactor = b as number;
			return jformat(fmt, boxDouble(this.samp.getNextSample(thisEnt as Entity, simTime) / siFactor));
		}

		const siFactor = a;

		// getNextString(Entity thisEnt, double simTime, double siFactor)
		if (b === undefined) {
			return jstr(this.samp.getNextSample(thisEnt as Entity, simTime) / siFactor);
		}

		// getNextString(Entity thisEnt, double simTime, double siFactor, boolean integerValue)
		const integerValue = b as boolean;
		if (integerValue) {
			return jstr(toInt(this.samp.getNextSample(thisEnt as Entity, simTime) / siFactor));
		}
		else {
			return jstr(this.samp.getNextSample(thisEnt as Entity, simTime) / siFactor);
		}
	}

	getNextValue(thisEnt: Entity | null, simTime: number): number {
		return this.samp.getNextSample(thisEnt as Entity, simTime);
	}

	toString(): string {
		return this.samp.toString();
	}

	getSampleProvider(): SampleProvider {
		return this.samp;
	}

}
