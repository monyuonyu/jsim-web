/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2020 JaamSim Software Inc.
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
import { tr } from "../internal.ts";
import { InputErrorException } from "../internal.ts";
import { isSubjectEntity } from "../internal.ts";
import type { SubjectEntity } from "./SubjectEntity.ts";

/**
 * interface の static のもの（ERR_WATCHLIST・registerWithSubjects・isObserverOf・validate）は、
 * 同じ名前の const ObserverEntity に置いた（ObserverEntity.validate(obs) のように Java と同じ書き方で呼べる）。
 */
export interface ObserverEntity {

	/**
	 * Performs the necessary updates when one or more of the subject entities being monitored
	 * has changed state.
	 * @param subj - subject entity that has changed state
	 */
	observerUpdate(subj: SubjectEntity): void;

	/**
	 * Return a list of the subject entities watched by this observer.
	 * @return list of subject entities
	 */
	getWatchList(): SubjectEntity[];
}

/** x instanceof ObserverEntity の代わり */
export function isObserverEntity(o: unknown): o is ObserverEntity {
	if (typeof o !== "object" || o === null)
		return false;
	const s = o as Partial<ObserverEntity>;
	return typeof s.observerUpdate === "function" && typeof s.getWatchList === "function";
}

export const ObserverEntity = {

	ERR_WATCHLIST: "WatchList verification error.\n\n"
			+ "A state change has occured that was not triggered by an object in the WatchList.\n"
			+ "Re-run the model with the Event Viewer open and review the events that occurred\n"
			+ "at the same simulation time as this error. One of the objects associated with\n"
			+ "these events needs to be added to the WatchList input.",

	/**
	 * Registers an observer with a list of subjects.
	 * @param obs - observer to be registered
	 * @param list - subjects being monitored by the observer
	 */
	registerWithSubjects(obs: ObserverEntity, list: SubjectEntity[]): void {
		for (const subj of list) {
			subj.registerObserver(obs);
		}
	},

	/**
	 * Returns whether the specified observer entity is watching the specified subject or if any
	 * of its subjects are watching the specified subject, and so on recursively.
	 * @param obs - observer
	 * @param subj - subject
	 * @return true if the observer is watching the subject directly or indirectly
	 */
	isObserverOf(obs: ObserverEntity, subj: SubjectEntity): boolean {
		for (const ent of obs.getWatchList()) {
			if (ent === subj || (isObserverEntity(ent)
					&& ObserverEntity.isObserverOf(ent, subj)))
				return true;
		}
		return false;
	},

	/**
	 * Tests whether there is a closed loop in the chain of observers and subjects.
	 * @param obs - observer
	 */
	validate(obs: ObserverEntity): void {
		if (!isSubjectEntity(obs))
			return;
		const subj = obs;
		if (ObserverEntity.isObserverOf(obs, subj))
			throw new InputErrorException(tr("The chain of WatchList inputs cannot include "
					+ "this entity."));
	},
};
