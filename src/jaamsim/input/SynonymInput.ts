import type { Entity } from "../basicsim/Entity.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class SynonymInput extends Input<unknown> {
	readonly input: Input<unknown>;

	constructor(key: string, input: Input<unknown>) {
		super(key, input.getCategory(), null);
		this.input = input;
	}

	override isSynonym(): boolean {
		return true;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		this.input.parse(thisEnt, kw);
	}
}
