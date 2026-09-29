import { ProcessTarget } from "../events/ProcessTarget.ts";
import type { Entity } from "./Entity.ts";

export abstract class EntityTarget<T extends Entity> extends ProcessTarget {
	protected readonly ent: T;
	private readonly desc: string;

	constructor(ent: T, method: string) {
		super();
		this.ent = ent;
		this.desc = method;
	}

	override getDescription(): string {
		return this.ent.getName() + "." + this.desc;
	}
}
