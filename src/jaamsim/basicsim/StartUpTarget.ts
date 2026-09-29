import { ProcessTarget } from "../events/ProcessTarget.ts";
import type { Entity } from "./Entity.ts";

export class StartUpTarget extends ProcessTarget {
	readonly ent: Entity;

	constructor(ent: Entity) {
		super();
		this.ent = ent;
	}

	override getDescription(): string {
		return this.ent.getName() + ".startUp";
	}

	override process(): void {
		this.ent.startUp();
	}
}
