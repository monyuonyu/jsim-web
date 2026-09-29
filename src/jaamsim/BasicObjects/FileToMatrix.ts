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

// 多重定義の扱い: setValue(ArrayList<ArrayList<Object>>) と、親の setValue(ExpResult) は、配列かどうかで見分ける。

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { ExpCollections } from "../input/ExpCollections.ts";
import type { ExpResult } from "../input/ExpResult.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { FileToArray } from "./FileToArray.ts";

export class FileToMatrix extends FileToArray {

	constructor() {
		super();
	}

	protected override getValueForTokens(tokens: string[][], simTime: number): ExpResult {
		const ret: ExpResult[] = [];
		for (const strRecord of tokens) {
			const record = FileToArray.getExpResultList(strRecord, this, simTime);
			const colRow = ExpCollections.wrapCollection(record, DimensionlessUnit);
			ret.push(colRow);
		}
		return ExpCollections.wrapCollection(ret, DimensionlessUnit);
	}

	/**
	 * Sets the data for the FileToMatrix directly from a Java data structure, without the use
	 * of the DataFile input which can be left blank. The matrix input can contain the following
	 * Java classes and their sub-classes: Double, Integer, String, Entity, List, Map, and Array.
	 * @param matrix - List of lists of Java objects containing the input data.
	 * @throws ExpError
	 * （配列でないものを渡したときは、親の setValue(ExpResult)）
	 */
	override setValue(matrix: unknown[][] | ExpResult): void {
		if (!Array.isArray(matrix)) {
			super.setValue(matrix);
			return;
		}

		const temp: ExpResult[] = [];
		for (const row of matrix) {
			const resRow = FileToArray.getExpResultList(row);
			const colRow = ExpCollections.wrapCollection(resRow, DimensionlessUnit);
			temp.push(colRow);
		}
		const val = ExpCollections.wrapCollection(temp, DimensionlessUnit);
		this.setValue(val);
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.FileToMatrix", FileToMatrix);
