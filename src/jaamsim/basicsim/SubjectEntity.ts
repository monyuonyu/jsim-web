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
