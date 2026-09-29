/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019 JaamSim Software Inc.
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

// 多重定義の扱い: setValue(Map<String, ArrayList<Object>>) と、親の setValue(ExpResult) は、Map かどうかで見分ける。

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { ExpCollections } from "../input/ExpCollections.ts";
import { ExpResType } from "../input/ExpResType.ts";
import type { ExpResult } from "../input/ExpResult.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { FileToArray } from "./FileToArray.ts";

/** Java の ArrayList<String>.toString()（"[a, b]"） */
function listToString(list: string[]): string {
	return "[" + list.join(", ") + "]";
}

export class FileToHashMap extends FileToArray {

	constructor() {
		super();
	}

	protected override getValueForTokens(tokens: string[][], simTime: number): ExpResult {
		const ret = new Map<string, ExpResult>();

		// Process each record from the file
		for (const strRecord of tokens) {
			const record = FileToArray.getExpResultList(strRecord, this, simTime);
			if (record.length < 1)
				this.error(tr("Entry has no key: %s"), listToString(strRecord));

			if (record[0].type !== ExpResType.STRING)
				this.error(tr("Key is not a string in record: %s"), listToString(strRecord));

			// Add the entry to the hashmap
			const key = record[0].stringVal;
			const list = record.slice(1, record.length);
			const colList = ExpCollections.wrapCollection(list, DimensionlessUnit);
			ret.set(key, colList);
		}
		return ExpCollections.wrapCollection(ret, DimensionlessUnit);
	}

	/**
	 * Sets the data for the FileToMatrix directly from a Java data structure, without the use
	 * of the DataFile input which can be left blank. The hashmap input can contain the following
	 * Java classes and their sub-classes: Double, Integer, String, Entity, List, Map, and Array.
	 * @param map - map whose values are a lists of Java objects containing the input data.
	 * @throws ExpError
	 * （Map でないものを渡したときは、親の setValue(ExpResult)）
	 */
	override setValue(map: Map<string, unknown[]> | ExpResult): void {
		if (!(map instanceof Map)) {
			super.setValue(map);
			return;
		}

		const temp = new Map<string, ExpResult>();
		for (const [key, value] of map) {
			const resRow = FileToArray.getExpResultList(value);
			const colRow = ExpCollections.wrapCollection(resRow, DimensionlessUnit);
			temp.set(key, colRow);
		}
		const val = ExpCollections.wrapCollection(temp, DimensionlessUnit);
		this.setValue(val);
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.FileToHashMap", FileToHashMap);
