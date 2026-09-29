import { tr } from "../i18n/I18n.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { isSubjectEntity } from "./SubjectEntity.ts";
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
