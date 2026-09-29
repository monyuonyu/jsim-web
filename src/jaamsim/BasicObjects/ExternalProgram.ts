/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2019-2024 JaamSim Software Inc.
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

// 外部プログラムの起動は BasicObjectsIO.runProgram に任せる（差し替えられる）。

import { Double } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { SampleInput } from "../internal.ts";
import { Entity } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { ExpCollections } from "../internal.ts";
import { Parser } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { AbstractExternalProgram } from "../internal.ts";
import { getBasicObjectsIO, splitLines, uriToPath } from "../internal.ts";
import { FileToArray } from "../internal.ts";

export class ExternalProgram extends AbstractExternalProgram {

	private readonly timeOut: SampleInput;

	constructor() {
		super();

		// Java の初期化ブロック
		this.timeOut = new SampleInput("TimeOut", Entity.KEY_INPUTS, 1000);
		this.setKeywordDoc(this.timeOut, "Maximum time in milliseconds for the external program to finish "
		                     + "executing.",
		         ["2000"]);
		this.timeOut.setValidRange(1, Double.POSITIVE_INFINITY);
		this.timeOut.setIntegerValue(true);
		this.addInput(this.timeOut);
	}

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);
		const simTime = EventManager.simSeconds();

		// Build the command to launch the external program
		const n = this.dataSource.getListSize();
		let m = 1;
		if (!this.inFile.isDefault())
			m = 2;
		const command: string[] = new Array<string>(n + m);

		// 1) Program executable
		command[0] = uriToPath(this.programFile.getValue());

		// 2) Input File (using default separator character)
		if (!this.inFile.isDefault()) {
			command[1] = uriToPath(this.inFile.getValue());
		}

		// 3) Command line parameters
		for (let i = 0; i < n; i++) {
			command[i + m] = this.dataSource.getNextString(i, this, simTime);
		}

		try {
			// Launch the external program
			// TODO(移植): Java 版は待ち時間（TimeOut）が過ぎても止めず、読み取りで終わるまで待つ。既定の実装も同じく止めない
			// Wait for the program to terminate
			// （Java の (long) の型変換。待ち時間は 1 以上の整数）
			const res = getBasicObjectsIO().runProgram(command, Math.trunc(this.timeOut.getNextSample(this, simTime)));

			// Check for an error in the external program
			const errLines = splitLines(res.stderr);
			if (errLines.length > 0) {
				throw new Error(errLines.join("\n"));
			}

			// Collect the outputs from the program
			const list: string[] = [];
			for (const line of splitLines(res.stdout)) {
				Parser.tokenize(list, line, false);
			}

			// Set the new output value
			const resList = FileToArray.getExpResultList(list, this, simTime);
			this.value = ExpCollections.wrapCollection(resList, DimensionlessUnit);
		}
		catch (e) {
			this.error((e as Error).message);
		}

		// Pass the entity to the next component
		this.sendToNextComponent(ent);
	}

}

ClassRegistry.register("com.jaamsim.BasicObjects.ExternalProgram", ExternalProgram);
