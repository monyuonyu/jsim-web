/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2020-2021 JaamSim Software Inc.
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
import { jformat } from "../java/lang.ts";
import type { Entity } from "./Entity.ts";
import type { ObserverEntity } from "./ObserverEntity.ts";
import type { SubjectEntity } from "./SubjectEntity.ts";

export class SubjectEntityDelegate implements SubjectEntity {

	private readonly subject: SubjectEntity;
	private readonly observerList: ObserverEntity[] = [];

	constructor(subj: SubjectEntity) {
		this.subject = subj;
	}

	clear(): void {
		this.observerList.length = 0;
	}

	registerObserver(obs: ObserverEntity): void {
		if (this.observerList.includes(obs))
			return;
		this.observerList.push(obs);
	}

	notifyObservers(): void {
		const ent = this.subject as unknown as Entity;
		if (ent.isTraceFlag()) ent.trace(0, "notifyObservers: %s", listToString(this.observerList));

		for (const obs of this.observerList) {
			obs.observerUpdate(this.subject);
		}
	}

	getObserverList(): ObserverEntity[] {
		return this.observerList;
	}

	toString(): string {
		return jformat("%s: %s", String(this.subject), listToString(this.observerList));
	}

}

/** Java の ArrayList.toString()（[a, b, c]） */
function listToString(list: unknown[]): string {
	return "[" + list.map(o => String(o)).join(", ") + "]";
}
