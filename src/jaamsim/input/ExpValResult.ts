/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2023 JaamSim Software Inc.
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
// 入れ子の enum ExpValResult.State は、同じ名前の namespace で ExpValResult.State として置いた。
import type { JClass } from "../java/lang.ts";
import { jformat } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import type { Unit } from "../units/Unit.ts";
import { ExpError } from "../internal.ts";
import { ExpResType } from "../internal.ts";

export class ExpValResult {

	public readonly state: ExpValResult.State;
	public readonly errors: ExpError[];

	public readonly unitType: JClass<Unit> | null;
	public readonly type: ExpResType | null;

	public static typeString(res: ExpResType | null): string {
		switch (res) {
		case ExpResType.ENTITY:
			return "entity";
		case ExpResType.NUMBER:
			return "number";
		case ExpResType.STRING:
			return "string";
		case ExpResType.COLLECTION:
			return "collection";
		case ExpResType.LAMBDA:
			return "function";
		default:
			return "unknown type";
		}
	}

	public static makeValidRes(t: ExpResType | null, ut: JClass<Unit> | null): ExpValResult {
		return new ExpValResult(ExpValResult.State.VALID, t, ut, null);
	}

	public static makeUndecidableRes(): ExpValResult {
		return new ExpValResult(ExpValResult.State.UNDECIDABLE, null, DimensionlessUnit, null);
	}

	/** Java の makeErrorRes(ArrayList<ExpError>) と makeErrorRes(ExpError) をまとめたもの */
	public static makeErrorRes(es: ExpError[] | ExpError): ExpValResult {
		if (es instanceof ExpError) {
			const list: ExpError[] = [];
			list.push(es);
			return new ExpValResult(ExpValResult.State.ERROR, null, DimensionlessUnit, list);
		}
		return new ExpValResult(ExpValResult.State.ERROR, null, DimensionlessUnit, es);
	}

	private constructor(s: ExpValResult.State, t: ExpResType | null, ut: JClass<Unit> | null, es: ExpError[] | null) {
		this.state = s;
		this.unitType = ut;
		this.type = t;

		if (es === null)
			this.errors = [];
		else
			this.errors = es;
	}

	public toString(): string {
		let utStr = "null";
		if (this.unitType !== null)
			utStr = ClassRegistry.simpleName(this.unitType);
		// Java の ArrayList.toString と同じ形（[a, b]）。ExpError の toString は "クラス名: メッセージ"
		const errStr = "[" + this.errors.map(e => "com.jaamsim.input.ExpError: " + e.message).join(", ") + "]";
		return jformat("state=%s, errors=%s, unitType=%s, type=%s",
				this.state, errStr, utStr, this.type);
	}

}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ExpValResult {
	/** Java の enum ExpValResult.State */
	export enum State {
		VALID = "VALID",
		ERROR = "ERROR",
		UNDECIDABLE = "UNDECIDABLE",
	}
}
