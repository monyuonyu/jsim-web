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
