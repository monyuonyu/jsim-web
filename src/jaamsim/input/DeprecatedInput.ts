import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class DeprecatedInput extends Input<string> {
	private fatal: boolean;

	constructor(key: string, msg: string) {
		super(key, "", "");
		this.value = msg;
		this.fatal = true;
	}

	setFatal(fatal: boolean): void {
		this.fatal = fatal;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		// Java は value を書式として渡す（引数なし）
		if (this.fatal)
			throw new InputErrorException(tr(this.value as string));

		thisEnt.getJaamSimModel().logWarning("%s - %s", this.getKeyword(), this.value);
	}
}
