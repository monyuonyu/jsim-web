/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2020-2023 JaamSim Software Inc.
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
import { EventManager } from "../events/EventManager.ts";
import { ProcessTarget } from "../events/ProcessTarget.ts";
import { FileInput } from "../input/FileInput.ts";
import { InputAgent } from "../input/InputAgent.ts";
import { ValueInput } from "../input/ValueInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { Entity } from "./Entity.ts";

// 入れ子のクラス ScriptEntity.ScriptTarget は、同じファイルの ScriptEntity_ScriptTarget にした
export class ScriptEntity extends Entity {
	private readonly scriptFileName: FileInput;

	private readonly scriptTime: ValueInput; // the time that has been read in the script

	private tokens: string[][];
	private lastTokenIdx = 0;

	private readonly targ: ProcessTarget;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.scriptFileName = new FileInput( "Script", Entity.KEY_INPUTS, null );
		this.setKeywordDoc(this.scriptFileName, "The name of the script file for the script entity.",
				["test.scr"]);
		this.scriptFileName.setRequired(true);
		this.addInput( this.scriptFileName );

		this.scriptTime = new ValueInput("Time", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.scriptTime, "The Time keyword appears inside the script file. The value represents "
				+ "the simulation time at which the next set of commands in the script "
				+ "are implemented.",
				["24.0 h"]);
		this.scriptTime.setUnitType(TimeUnit);
		this.scriptTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.scriptTime);

		this.targ = new ScriptEntity_ScriptTarget(this);

		// ---- Java のコンストラクタ ----
		this.tokens = [];
	}

	override earlyInit(): void {
		super.earlyInit();

		this.tokens.length = 0;
		this.lastTokenIdx = -1;

		// Open the script file
		this.tokens = FileInput.getTokensFromURI(this.scriptFileName.getValue()!)!;
		const simModel = this.getJaamSimModel();
		const record = simModel.isRecordEdits();
		simModel.setRecordEdits(false);
		// Read records until a Time record is read
		// Restarts will work for simple scripts with a record at Time 0
		// Restarts should work for all scripts provided the script has initial inputs before the first Time record
		for (this.lastTokenIdx++; this.lastTokenIdx < this.tokens.length; this.lastTokenIdx++) {
			InputAgent.processKeywordRecord(simModel, this.tokens[this.lastTokenIdx], null);
			if( this.tokens[this.lastTokenIdx][0] === this.getName() ) {
				if( this.tokens[this.lastTokenIdx][1] === "Time" ) {
					this.lastTokenIdx--;
					break;
				}
			}
		}
		simModel.setRecordEdits(record);
	}

	override startUp(): void {
		super.startUp();
		this.doScript();
	}

	/**
	 * Read the script
	 */
	doScript(): void {
		const simModel = this.getJaamSimModel();
		const record = simModel.isRecordEdits();
		simModel.setRecordEdits(false);
		for (this.lastTokenIdx++; this.lastTokenIdx < this.tokens.length; this.lastTokenIdx++) {
			InputAgent.processKeywordRecord(simModel, this.tokens[this.lastTokenIdx], null);
			// If a "Time" record was read, then wait until the time
			const delayTicks = EventManager.current().secondsToNearestTick(this.scriptTime.getValue() as number) - EventManager.simTicks();
			if (delayTicks > 0) {
				EventManager.scheduleTicks(delayTicks, Entity.PRI_HIGHEST, Entity.EVT_LIFO, this.targ, null);
				break;
			}
		}
		simModel.setRecordEdits(record);
	}
}

class ScriptEntity_ScriptTarget extends ProcessTarget {
	readonly script: ScriptEntity;

	constructor(script: ScriptEntity) {
		super();
		this.script = script;
	}

	override getDescription(): string {
		return this.script.getName() + ".doScript";
	}

	override process(): void {
		this.script.doScript();
	}
}

ClassRegistry.register("com.jaamsim.basicsim.ScriptEntity", ScriptEntity);
