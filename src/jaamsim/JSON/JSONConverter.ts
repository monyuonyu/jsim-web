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

// Java の HashMap<String, ExpResult> は、Java と同じ順番で回る StringHashMap（input/ExpCollections.ts）にした。

import { tr } from "../i18n/I18n.ts";
import { ExpCollections, StringHashMap } from "../input/ExpCollections.ts";
import { ExpError } from "../input/ExpError.ts";
import { ExpResType } from "../input/ExpResType.ts";
import { ExpResult } from "../input/ExpResult.ts";
import { JavaHashOrder } from "../ProcessFlow/MappedTreeSet.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { JSONValue } from "./JSONValue.ts";

export class JSONConverter {

	/** @throws ExpError */
	static fromExpResult(val: ExpResult): JSONValue {
		if (val.type === ExpResType.NUMBER) {
			return JSONValue.makeNumVal(val.value);
		}
		if (val.type === ExpResType.STRING) {
			return JSONValue.makeStringVal(val.stringVal!);
		}

		if (val.type === ExpResType.ENTITY) {
			return JSONValue.makeStringVal(val.entVal!.getName());
		}

		if (val.type === ExpResType.LAMBDA) {
			throw new ExpError(null, 0, tr("Can not convert lambda value to JSON"));
		}

		if (val.type === ExpResType.COLLECTION) {
			return JSONConverter.fromCollection(val.colVal!);
		}

		throw new ExpError(null, 0, tr("Internal error: invalid expression value type"));

	}

	/** @throws ExpError */
	private static fromCollection(col: ExpResult.Collection): JSONValue {
		const it = col.getIter();
		const ret = new JSONValue();
		if (!it.hasNext()) {
			// Emit an empty list for any empty object type
			ret.listVal = [];
			return ret;
		}
		let seenFirst = false;
		let isObject = false;
		let valueCount = 1;
		while (it.hasNext()) {
			const key = it.nextKey();
			const val = col.index(key);
			if (!seenFirst) {
				// Check the type of the first key to determine if this is a JSON object or a JSON array
				if (key.type === ExpResType.NUMBER) {
					isObject = false;
					ret.listVal = [];
				} else if (key.type === ExpResType.STRING) {
					isObject = true;
					ret.mapVal = new JavaHashOrder<JSONValue>();
				}
				seenFirst = true;
			}

			if (isObject) {
				if (key.type !== ExpResType.STRING) {
					throw new ExpError(null, 0, tr("When converting to JSON all keys in a map must be strings"));
				}
				ret.mapVal.set(key.stringVal!, JSONConverter.fromExpResult(val));
			} else {
				// not an object, therefore is an array
				if (key.type !== ExpResType.NUMBER) {
					throw new ExpError(null, 0, tr("When converting to JSON all keys in an array must be numbers"));
				}
				if (key.value !== valueCount) {
					throw new ExpError(null, 0, tr("Internal error, key values out of sync"));
				}
				// Java では listVal が null のまま（最初のキーが数でも文字列でもない）なら NullPointerException
				ret.listVal.push(JSONConverter.fromExpResult(val));
				valueCount++;
			}
		}
		return ret;
	}

	static toExpResult(val: JSONValue): ExpResult {
		if (val.isMap()) {
			const expMap = new StringHashMap<ExpResult>();
			for (const [key, value] of val.mapVal.entries()) {
				expMap.put(key, JSONConverter.toExpResult(value));
			}
			return ExpCollections.wrapCollection(expMap, DimensionlessUnit);
		}
		if (val.isList()) {
			const expList: ExpResult[] = [];
			for (const v of val.listVal) {
				expList.push(JSONConverter.toExpResult(v));
			}
			return ExpCollections.wrapCollection(expList, DimensionlessUnit);
		}
		if (val.isString()) {
			return ExpResult.makeStringResult(val.stringVal);
		}
		if (val.isNumber()) {
			return ExpResult.makeNumResult(val.numVal, DimensionlessUnit);
		}
		if (val.isTrue()) {
			return ExpResult.makeNumResult(1.0, DimensionlessUnit);
		}
		if (val.isFalse()) {
			return ExpResult.makeNumResult(0.0, DimensionlessUnit);
		}
		if (val.isNull()) {
			// Java の assert(false)（普段は無効）: This needs to be audited to be sure it's safe
			return ExpResult.makeEntityResult(null);
		}
		// Java の assert(false)（普段は無効）
		return null as unknown as ExpResult;
	}
}
