/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2020-2024 JaamSim Software Inc.
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

// 名前の無い ProcessTarget（updateTarget）は、ファイルの中のクラス UpdateTarget にした。
// 多重定義の扱い: setPresentState()（この部品の状態を決める）と、親の setPresentState(String) は、
// 引数があるかどうかで見分ける（親の AbstractStateUserEntity も同じ作りである前提）。

import { ClassRegistry } from "../java/ClassRegistry.ts";
import { AbstractStateUserEntity } from "../ProcessFlow/AbstractStateUserEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import { isSubjectEntity, type SubjectEntity } from "../basicsim/SubjectEntity.ts";
import { SubjectEntityDelegate } from "../basicsim/SubjectEntityDelegate.ts";
import { EventHandle } from "../events/EventHandle.ts";
import { EventManager } from "../events/EventManager.ts";
import { ProcessTarget } from "../events/ProcessTarget.ts";
import { ExpResType } from "../input/ExpResType.ts";
import { ExpressionInput } from "../input/ExpressionInput.ts";
import { InterfaceEntityListInput } from "../input/InterfaceEntityListInput.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";

/** InterfaceEntityListInput に渡す、interface SubjectEntity の Class の代わり（ProcessFlow/LinkedService.ts と同じ作り） */
const SubjectEntityClass = {
	[Symbol.hasInstance](o: unknown): o is SubjectEntity {
		return isSubjectEntity(o);
	},
};

export class EntitySystem extends AbstractStateUserEntity implements ObserverEntity, SubjectEntity {

	protected readonly stateExp: ExpressionInput;

	protected readonly watchList: InterfaceEntityListInput<SubjectEntity>;

	private readonly subject: SubjectEntityDelegate;

	private readonly updateHandle: EventHandle;
	private readonly updateTarget: ProcessTarget;

	constructor() {
		super();

		// Java のフィールドの初期値（初期化ブロックの前に書かれている）
		this.subject = new SubjectEntityDelegate(this);

		// Java の初期化ブロック
		this.stateExp = new ExpressionInput("StateExpression", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.stateExp, "An expression returning a string that sets this object's present "
		                     + "state. "
		                     + "If left blank, the state will be set to Working if any of the "
		                     + "entities specified by the WatchList input are working. "
		                     + "It will be set to Idle if all of the entities in the WatchList are "
		                     + "idle.",
		         ["'[Server1].Working || [Server2].Working ? \"Working\" : \"Idle\"'"]);
		this.stateExp.setResultType(ExpResType.STRING);
		this.addInput(this.stateExp);

		this.watchList = new InterfaceEntityListInput<SubjectEntity>(SubjectEntityClass, "WatchList", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.watchList, "A list of objects to monitor.\n\n"
		                     + "The system's state will be re-calculated whenever one of "
		                     + "the WatchList objects changes state.",
		         ["Object1  Object2"]);
		this.watchList.setIncludeSelf(false);
		this.watchList.setUnique(true);
		this.watchList.setRequired(true);
		this.addInput(this.watchList);

		// Java のフィールドの初期値（初期化ブロックの後に書かれている）
		this.updateHandle = new EventHandle();
		this.updateTarget = new UpdateTarget(this);
	}

	override validate(): void {
		super.validate();
		ObserverEntity.validate(this);
	}


	override lateInit(): void {
		super.lateInit();
		ObserverEntity.registerWithSubjects(this, this.getWatchList());
	}

	registerObserver(obs: ObserverEntity): void {
		this.subject.registerObserver(obs);
	}

	notifyObservers(): void {
		this.subject.notifyObservers();
	}

	override getObserverList(): ObserverEntity[] {
		return this.subject.getObserverList();
	}

	getWatchList(): SubjectEntity[] {
		return this.watchList.getValue();
	}

	observerUpdate(subj: SubjectEntity): void {
		if (this.updateHandle.isScheduled())
			return;
		EventManager.scheduleTicks(0, Entity.PRI_LOWER, Entity.EVT_LIFO, this.updateTarget, this.updateHandle);
	}

	override isBusy(): boolean {
		for (const subj of this.getWatchList()) {
			if (!(subj instanceof AbstractStateUserEntity))
				continue;
			if (subj.isBusy())
				return true;
		}
		return false;
	}

	override isMaintenance(): boolean {
		for (const subj of this.getWatchList()) {
			if (!(subj instanceof AbstractStateUserEntity))
				continue;
			if (subj.isMaintenance())
				return true;
		}
		return false;
	}

	override isBreakdown(): boolean {
		for (const subj of this.getWatchList()) {
			if (!(subj instanceof AbstractStateUserEntity))
				continue;
			if (subj.isBreakdown())
				return true;
		}
		return false;
	}

	override isStopped(): boolean {
		for (const subj of this.getWatchList()) {
			if (!(subj instanceof AbstractStateUserEntity))
				continue;
			if (subj.isStopped())
				return true;
		}
		return false;
	}

	override isSetup(): boolean {
		for (const subj of this.getWatchList()) {
			if (!(subj instanceof AbstractStateUserEntity))
				continue;
			if (subj.isSetup())
				return true;
		}
		return false;
	}

	override isSetdown(): boolean {
		for (const subj of this.getWatchList()) {
			if (!(subj instanceof AbstractStateUserEntity))
				continue;
			if (subj.isSetdown())
				return true;
		}
		return false;
	}

	override isIdle(): boolean {
		for (const subj of this.getWatchList()) {
			if (!(subj instanceof AbstractStateUserEntity))
				continue;
			if (!subj.isIdle())
				return false;
		}
		return true;
	}

	/**
	 * Java の setPresentState()（この部品の状態を決める）と、親の setPresentState(String)。
	 * 引数を渡したときは親の関数を呼ぶ。
	 */
	override setPresentState(state?: string): void {
		if (state !== undefined) {
			super.setPresentState(state);
			return;
		}

		// Calculate the default state if no StateExpression is provided
		if (this.stateExp.isDefault()) {
			super.setPresentState();
			return;
		}

		// Calculate the state from the StateExpression input
		const str = this.stateExp.getNextResult(this, EventManager.simSeconds()).stringVal;
		this.setPresentState(str);
		if (this.isTraceFlag()) this.trace(1, "setPresentState - %s", str);
	}

	getEntityList(simTime: number): AbstractStateUserEntity[] {
		const ret: AbstractStateUserEntity[] = [];
		for (const subj of this.getWatchList()) {
			if (!(subj instanceof AbstractStateUserEntity))
				continue;
			ret.push(subj);
		}
		return ret;
	}

}

/** Java の名前の無い ProcessTarget（updateTarget） */
class UpdateTarget extends ProcessTarget {
	constructor(private readonly ent: EntitySystem) {
		super();
	}

	override process(): void {
		this.ent.setPresentState();
	}

	override getDescription(): string {
		return this.ent.getName() + ".setPresentState";
	}
}

ClassRegistry.register("com.jaamsim.BasicObjects.EntitySystem", EntitySystem);

defineOutput(EntitySystem, {
	name: "EntityList",
	description: "Entities included in this system. "
	           + "Consists of the entities in the WatchList for which a state can be obtained.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getEntityList(simTime),
});
