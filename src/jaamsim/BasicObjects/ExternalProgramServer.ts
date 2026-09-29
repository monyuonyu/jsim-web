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

// 外部プログラムの起動とやり取りは BasicObjectsIO.startServerProcess に任せる（差し替えられる）。
// Java 版の process・resReader・reqWriter・errorThread は、ExternalServerProcess 1 つにまとめた。
// 入れ子のクラス ErrorLogger（標準エラーを Log に書くスレッド）は、ファイルの中のクラスにした
// （行が届くたびに呼ばれる関数を持つ）。

import { ClassRegistry } from "../internal.ts";
import { jformat } from "../internal.ts";
import { tr } from "../internal.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { JSONConverter } from "../internal.ts";
import { JSONParser } from "../internal.ts";
import { JSONValue } from "../internal.ts";
import { JSONWriter } from "../internal.ts";
import { Entity } from "../internal.ts";
import { Log } from "../internal.ts";
import { EventManager } from "../internal.ts";
import { ExpCollections } from "../internal.ts";
import { StringInput } from "../internal.ts";
import { DimensionlessUnit } from "../internal.ts";
import { AbstractExternalProgram } from "../internal.ts";
import { getBasicObjectsIO, uriToPath } from "../internal.ts";
import { type ExternalServerProcess } from "./BasicObjectsIO.ts";

export class ExternalProgramServer extends AbstractExternalProgram {

	private readonly methodInput: StringInput;

	private process: ExternalServerProcess | null = null;
	private nextID = 1;

	constructor() {
		super();

		// Java の初期化ブロック
		this.methodInput = new StringInput("MethodName", Entity.KEY_INPUTS, "method");
		this.setKeywordDoc(this.methodInput, "Name of the RPC method to call in the external program",
		                     ["calculateDelay"]);
		this.methodInput.setRequired(true);
		this.addInput(this.methodInput);
	}

	override earlyInit(): void {
		super.earlyInit();

		this.startProcess();
	}

	override kill(): void {
		super.kill();

		if (this.process !== null) {
			this.killProcess();
		}
	}

	private startProcess(): void {

		if (this.process !== null) {
			this.killProcess();
		}

		// Build the command to launch the external program
		let m = 1;
		if (!this.inFile.isDefault())
			m = 2;
		const command: string[] = new Array<string>(m);

		// 1) Program executable
		command[0] = uriToPath(this.programFile.getValue());

		// 2) Input File (using default separator character)
		if (!this.inFile.isDefault()) {
			command[1] = uriToPath(this.inFile.getValue());
		}

		try {
			// Launch the external program
			// Spawn a separate thread to read stderr of the process and forward anything to the log box
			const errorLogger = new ErrorLogger(this.getName());
			this.process = getBasicObjectsIO().startServerProcess(command, line => errorLogger.run(line));
		}
		catch (e) {
			this.error((e as Error).message);
		}
	}

	private killProcess(): void {
		this.process!.destroy();
		this.process = null;
		// The thread will stop on it's own when the process terminates
	}

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);
		const simTime = EventManager.simSeconds();

		// Build the command to launch the external program
		const n = this.dataSource.getListSize();

		const args: string[] = new Array<string>(n);

		for (let i = 0; i < n; i++) {
			args[i] = this.dataSource.getNextString(i, this, simTime);
		}

		try {

			const expArgs = ExpCollections.wrapCollection(args, DimensionlessUnit);
			const jsonArgs = JSONConverter.fromExpResult(expArgs);

			const request = JSONValue.makeObject();
			request.mapVal.set("jsonrpc", JSONValue.makeStringVal("2.0"));
			request.mapVal.set("id", JSONValue.makeNumVal(++this.nextID));
			request.mapVal.set("method", JSONValue.makeStringVal(this.methodInput.getValue()));
			request.mapVal.set("params", jsonArgs);

			const reqJSON = JSONWriter.writeJSONValue(request);

			// Java 版は process が無いと NullPointerException になる（その message は null）
			if (this.process === null)
				throw new Error("null");
			this.process.writeLine(reqJSON);

			// Collect the outputs from the program
			const resParser = new JSONParser();
			while (true) {
				const line = this.process.readLine();
				resParser.addPiece(line);
				if (resParser.isElementComplete())
					break;
				if (line === null) {
					throw new Error(tr("External server program terminated early!"));
				}
			}
			if (!resParser.isElementComplete()) {
				throw new Error(tr("External program returned invalid JSON"));
			}
			const response = resParser.parse();
			// Validate the response
			if (!response.isMap() || !response.mapVal.get("jsonrpc")!.isString() || response.mapVal.get("jsonrpc")!.stringVal !== "2.0") {
				throw new Error(tr("External server returned invalid JSON"));
			}
			// Check for returned error
			const err = response.mapVal.get("error");
			if (err !== undefined && err !== null) {
				// returned error
				if (!err.isMap()) throw new Error(tr("External server program returned invalid error object"));
				const errMsg = err.mapVal.get("message")!.stringVal;
				throw new Error(jformat(tr("External server returned error: %s"), errMsg));
			}

			// Set the new output value
			const result = response.mapVal.get("result");
			if (result === undefined || result === null) {
				throw new Error(jformat(tr("JSON-RPC response missing result field")));
			}
			this.value = JSONConverter.toExpResult(result);

		}
		catch (e) {
			this.error((e as Error).message);
		}

		// Pass the entity to the next component
		this.sendToNextComponent(ent);
	}

}

/** Java の入れ子のクラス ErrorLogger（標準エラーの 1 行ごとに run が呼ばれる） */
class ErrorLogger {
	private readonly entityName: string;

	constructor(entName: string) {
		this.entityName = entName;
	}

	run(line: string): void {
		try {
			Log.format("%s error: %s", this.entityName, line);
		} catch (e) {
			// Some kind of logic here
			Log.format("Error in %s error monitor: %s", this.entityName, (e as Error).message);
		}
	}
}

ClassRegistry.register("com.jaamsim.BasicObjects.ExternalProgramServer", ExternalProgramServer);
