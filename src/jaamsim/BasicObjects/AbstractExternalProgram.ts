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

import { LinkedComponent } from "../internal.ts";
import { StringProvListInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { ExpCollections } from "../internal.ts";
import type { ExpResult } from "../input/ExpResult.ts";
import { FileInput } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { FileToArray } from "../internal.ts";

export abstract class AbstractExternalProgram extends LinkedComponent {

	protected readonly programFile: FileInput;

	protected readonly inFile: FileInput;

	protected readonly dataSource: StringProvListInput;

	protected readonly initialValue: StringProvListInput;

	protected value: ExpResult;  // outputs returned by the external program

	static readonly initialValueCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as AbstractExternalProgram).updateInitialValue();
		},
	};

	constructor() {
		super();

		// Java の初期化ブロック
		this.programFile = new FileInput("ProgramFile", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.programFile, "External program file. "
		                     + "If the external program is written in Python, the program file "
		                     + "is the executable for Python interpreter (python.exe).",
		         ["'c:/Program Files/program.exe'",
		          "'c:/ProgramData/Anaconda3/python.exe'"]);
		this.programFile.setRequired(true);
		this.addInput(this.programFile);

		this.inFile = new FileInput("InputFile", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.inFile, "Optional input file for the external program. "
		                     + "If the external program is written in Python, the input file "
		                     + "is the python code file (*.py)",
		         ["'c:/test/inputs.dat'", "code.py"]);
		this.addInput(this.inFile);

		this.dataSource = new StringProvListInput("DataSource", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.dataSource, "A list of expressions that provide the parameters to the external "
		                     + "program. The inputs must be provided in the order in which they are "
		                     + "to be entered in the external program's command line.",
		         ["{ [Server1].Working } { '[Queue1].AverageQueueTime / 1[h]' }"]);
		this.addInput(this.dataSource);

		this.initialValue = new StringProvListInput("InitialValue", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.initialValue, "The 'Value' output prior to receiving the first entity.",
		         ["{ 0 }"]);
		this.initialValue.setCallback(AbstractExternalProgram.initialValueCallback);
		this.addInput(this.initialValue);

		// Java のコンストラクタ
		this.value = ExpCollections.wrapCollection([] as ExpResult[], DimensionlessUnit);
	}

	updateInitialValue(): void {
		this.value = this.getInitialValue();
	}

	protected getInitialValue(): ExpResult {
		let n = 0;
		if (!this.initialValue.isDefault())
			n = this.initialValue.getListSize();

		const list: string[] = [];
		for (let i = 0; i < n; i++) {
			list.push(this.initialValue.getNextString(i, this, 0.0));
		}
		const resList = FileToArray.getExpResultList(list, this, 0.0);
		return ExpCollections.wrapCollection(resList, DimensionlessUnit);
	}

	override earlyInit(): void {
		super.earlyInit();
		this.value = this.getInitialValue();
	}

	getValue(simTime: number): ExpResult {
		return this.value;
	}

}

defineOutput(AbstractExternalProgram, {
	name: "Value",
	description: "An array of values returned by the external program after parsing. "
	           + "Returned strings are converted automatically to numbers, times, or entities, "
	           + "if appropriate. "
	           + "For example, if the external program returns a single number, its value is "
	           + "'this.Value(1)'",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "ExpResult",
	get: (e, simTime) => e.getValue(simTime),
});
