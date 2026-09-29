/*
 * JaamSim Discrete Event Simulation
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

// 多重定義の扱い:
// - getExpResultList(ArrayList<String>, Entity, double) と getExpResultList(ArrayList<Object>) は、引数の数で見分ける
// - setValue(ExpResult)（この部品）と、子の setValue(ArrayList・Map) は、子の側で配列・Map かどうかで見分ける
// ファイルの読み込みは FileInput.getTokensFromURI（input の担当）が行う。

import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { LinkedComponent } from "../ProcessFlow/LinkedComponent.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { ExpCollections } from "../input/ExpCollections.ts";
import { ExpError } from "../input/ExpError.ts";
import { ExpEvaluator } from "../input/ExpEvaluator.ts";
import { ExpParser } from "../input/ExpParser.ts";
import { ExpResult } from "../input/ExpResult.ts";
import { FileInput } from "../input/FileInput.ts";
import { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";

export abstract class FileToArray extends LinkedComponent {

	private readonly dataFile: FileInput;

	private value!: ExpResult;

	static readonly dataFileInputCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as FileToArray).updateDateFile();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.nextComponent.setRequired(false);

		this.dataFile = new FileInput("DataFile", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.dataFile, "A text file containing one or more records whose entries are "
		                     + "delimited by tabs and/or spaces.\n\n"
		                     + "The following types of entries can be used. "
		                     + "If an entry includes spaces, double quotation marks, or curly braces, "
		                     + "it must be enclosed by single quotation marks.\n"
		                     + "- Comments. Records that begin with a # symbol are ignored (e.g. # abc)\n"
		                     + "- Numbers with or without units, specified in expression format (e.g. 5.2[m])\n"
		                     + "- Strings (e.g. 'quick red fox' or quick_red_fox)\n"
		                     + "- Entity names (e.g. DisplayEntity1)\n"
		                     + "- Time stamps in YYYY-MM-DD HH:MM:SS.SSS or YYYY-MM-DDTHH:MM:SS.SSS format "
		                     + "(e.g. '2018-06-31 13:00:00.000' or 2018-06-31T13:00:00.000)\n"
		                     + "- Arrays of numbers, entities, strings, or arrays, specified in expression format "
		                     + "(e.g. '{ 5[m], \"abc\", [DisplayEntity1] }'\n"
		                     + "- Expressions. A valid expression is executed and saved when the file is read "
		                     + "(e.g. 1[m]/2[s] is saved as 1.0[m/s]). An invalid expression is saved as a string.\n\n"
		                     + "When JaamSim is executed from the API, the DataFile input can be "
		                     + "replaced by a call to the setValue method for this object, which "
		                     + "populates the data directly.",
		         ["'c:/test/data.txt'"]);
		this.dataFile.setCallback(FileToArray.dataFileInputCallback);
		this.addInput(this.dataFile);

		// Java のコンストラクタ
		this.clearValue();
	}

	protected clearValue(): void {
		const resList: ExpResult[] = [];
		this.value = ExpCollections.wrapCollection(resList, DimensionlessUnit);
	}

	updateDateFile(): void {
		if (this.dataFile.getValue() === null) {
			this.clearValue();
			return;
		}
		this.setValueForURI(this.dataFile.getValue(), 0.0);
	}

	override earlyInit(): void {
		super.earlyInit();
		if (this.dataFile.getValue() !== null)
			this.setValueForURI(this.dataFile.getValue(), 0.0);
	}

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);
		if (this.dataFile.getValue() !== null)
			this.setValueForURI(this.dataFile.getValue(), EventManager.simSeconds());
		this.sendToNextComponent(ent);
	}

	protected setValue(val: ExpResult): void {
		this.value = val;
	}

	private setValueForURI(uri: ReturnType<FileInput["getValue"]>, simTime: number): void {
		const tokens: string[][] = FileInput.getTokensFromURI(uri);
		this.value = this.getValueForTokens(tokens, simTime);
	}

	protected abstract getValueForTokens(tokens: string[][], simTime: number): ExpResult;

	static getExpResult(str: string, thisEnt: Entity, simTime: number): ExpResult {
		const simModel = thisEnt.getJaamSimModel();

		// Is the entry a time stamp?
		if (Input.isRFC8601DateTime(str)) {
			try {
				const time = Input.parseRFC8601DateTime(simModel, str);
				return ExpResult.makeNumResult(time, TimeUnit);
			}
			catch (e) {}
		}

		// Is the entry an entity?
		const ent = simModel.getNamedEntity(str);
		if (ent !== null) {
			return ExpResult.makeEntityResult(ent);
		}

		// Is the entry a valid expression?
		try {
			const pc = ExpEvaluator.getParseContext(thisEnt, str);
			const exp = ExpParser.parseExpression(pc, str);
			return ExpEvaluator.evaluateExpression(exp, thisEnt, simTime);
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
		}

		// If all else fails, return a string
		return ExpResult.makeStringResult(str);
	}

	/**
	 * Java の getExpResultList(ArrayList<String> list, Entity thisEnt, double simTime) と、
	 * getExpResultList(ArrayList<Object> list)（throws ExpError）。thisEnt を渡したかどうかで見分ける。
	 */
	static getExpResultList(list: string[], thisEnt: Entity, simTime: number): ExpResult[];
	static getExpResultList(list: unknown[]): ExpResult[];
	static getExpResultList(list: unknown[], thisEnt?: Entity, simTime?: number): ExpResult[] {
		const ret: ExpResult[] = [];
		if (thisEnt !== undefined) {
			for (const str of list as string[]) {
				ret.push(FileToArray.getExpResult(str, thisEnt, simTime!));
			}
			return ret;
		}

		for (const obj of list) {
			const res = ExpEvaluator.getResultFromObject(obj, DimensionlessUnit);
			ret.push(res);
		}
		return ret;
	}

	getValue(simTime: number): ExpResult {
		return this.value;
	}

}

defineOutput(FileToArray, {
	name: "Value",
	description: "An array or map containing the data from the input file.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "ExpResult",
	get: (e, simTime) => e.getValue(simTime),
});
