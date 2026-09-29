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
import type { ObserverEntity } from "./ObserverEntity.ts";

export interface SubjectEntity {

	/**
	 * Records that the specified entity is monitoring this subject entity.
	 * @param obs - observer entity monitoring this subject entity
	 */
	registerObserver(obs: ObserverEntity): void;

	/**
	 * Notifies the observers that are monitoring this subject entity that a state change has
	 * occurred.
	 */
	notifyObservers(): void;

	/**
	 * Returns a list of the observers that are monitoring this subject entity.
	 * @return list of observers
	 */
	getObserverList(): ObserverEntity[];

}

/** x instanceof SubjectEntity の代わり */
export function isSubjectEntity(o: unknown): o is SubjectEntity {
	if (typeof o !== "object" || o === null)
		return false;
	const s = o as Partial<SubjectEntity>;
	return typeof s.registerObserver === "function" && typeof s.notifyObservers === "function"
			&& typeof s.getObserverList === "function";
}

/**
 * Java の SubjectEntity.class の代わり（InterfaceEntityInput などに渡す。JInterface の形）。
 * instanceof SubjectEntityClass とも書ける。
 */
export const SubjectEntityClass = {
	javaName: "com.jaamsim.basicsim.SubjectEntity",
	isInstance(o: unknown): o is SubjectEntity {
		return isSubjectEntity(o);
	},
	[Symbol.hasInstance](o: unknown): o is SubjectEntity {
		return isSubjectEntity(o);
	},
};
