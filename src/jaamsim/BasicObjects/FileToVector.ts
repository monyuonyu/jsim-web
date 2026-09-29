/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2018 JaamSim Software Inc.
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

// 多重定義の扱い: setValue(ArrayList<Object>) と、親の setValue(ExpResult) は、配列かどうかで見分ける。

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { ExpCollections } from "../input/ExpCollections.ts";
import type { ExpResult } from "../input/ExpResult.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { FileToArray } from "./FileToArray.ts";

export class FileToVector extends FileToArray {

	constructor() {
		super();
	}

	protected override getValueForTokens(tokens: string[][], simTime: number): ExpResult {
		let n = 0;
		for (const record of tokens) {
			n += record.length;
		}
		const ret: ExpResult[] = [];  // Java は大きさ n を先に取るだけ（中身は空）
		void n;
		for (const record of tokens) {
			const expRecord = FileToArray.getExpResultList(record, this, simTime);
			for (const res of expRecord)  // Java の addAll
				ret.push(res);
		}
		return ExpCollections.wrapCollection(ret, DimensionlessUnit);
	}

	/**
	 * Sets the data for the FileToVector directly from a Java data structure, without the use
	 * of the DataFile input which can be left blank. The list input can contain the following
	 * Java classes and their sub-classes: Double, Integer, String, Entity, List, Map, and Array.
	 * @param list - List of Java objects containing the input data.
	 * （配列でないものを渡したときは、親の setValue(ExpResult)）
	 */
	override setValue(list: unknown[] | ExpResult): void {
		if (!Array.isArray(list)) {
			super.setValue(list);
			return;
		}

		const resList = FileToArray.getExpResultList(list);
		const val = ExpCollections.wrapCollection(resList, DimensionlessUnit);
		this.setValue(val);
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.FileToVector", FileToVector);
