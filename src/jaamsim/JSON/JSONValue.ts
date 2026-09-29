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

// Java の HashMap<String, JSONValue> は、Java と同じ順番で回る JavaHashOrder（ProcessFlow/MappedTreeSet.ts）にした
// （JSONWriter が書き出す順番が Java と同じになるように）。set・get・has・entries・keys が使える。
// Java で null になっているフィールド（mapVal・listVal・stringVal）は、TS でも null を入れる。
// 使う側（ExternalProgramServer など）が Java と同じく null の確かめなしに書けるように、型は null を含めていない。

import { JavaHashOrder } from "../ProcessFlow/MappedTreeSet.ts";

export class JSONValue {
	public mapVal: JavaHashOrder<JSONValue> = null as unknown as JavaHashOrder<JSONValue>;
	public listVal: JSONValue[] = null as unknown as JSONValue[];
	public stringVal: string = null as unknown as string;
	public numVal = 0.0;
	public isKey = false;

	// If isKey is true, numVal will be one of the following values
	public static NULL_VAL = 0.0;
	public static TRUE_VAL = 1.0;
	public static FALSE_VAL = 2.0;

	isMap(): boolean { return this.mapVal != null; }
	isList(): boolean { return this.listVal != null; }
	isString(): boolean { return this.stringVal != null; }
	isKeyword(): boolean { return this.isKey; }
	isNumber(): boolean {
		return this.mapVal == null && this.listVal == null && this.stringVal == null && !this.isKey;
	}

	// Helpers
	isNull(): boolean {
		return this.isKey && this.numVal === JSONValue.NULL_VAL;
	}
	isTrue(): boolean {
		return this.isKey && this.numVal === JSONValue.TRUE_VAL;
	}
	isFalse(): boolean {
		return this.isKey && this.numVal === JSONValue.FALSE_VAL;
	}

	static makeStringVal(s: string | null): JSONValue {
		const ret = new JSONValue();
		ret.stringVal = s as string;
		return ret;
	}
	static makeNumVal(num: number): JSONValue {
		const ret = new JSONValue();
		ret.numVal = num;
		return ret;
	}
	static makeTrueVal(): JSONValue {
		const ret = new JSONValue();
		ret.numVal = JSONValue.TRUE_VAL;
		ret.isKey = true;
		return ret;
	}
	static makeFalseVal(): JSONValue {
		const ret = new JSONValue();
		ret.numVal = JSONValue.FALSE_VAL;
		ret.isKey = true;
		return ret;
	}
	static makeNullVal(): JSONValue {
		const ret = new JSONValue();
		ret.numVal = JSONValue.NULL_VAL;
		ret.isKey = true;
		return ret;
	}
	static makeObject(): JSONValue {
		const ret = new JSONValue();
		ret.mapVal = new JavaHashOrder<JSONValue>();
		return ret;
	}
	static makeArray(): JSONValue {
		const ret = new JSONValue();
		ret.listVal = [];
		return ret;
	}
}
