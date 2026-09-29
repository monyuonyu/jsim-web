import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";
import { Parser } from "./Parser.ts";

export class StringInput extends Input<string> {

	constructor(key: string, cat: string, def: string | null) {
		super(key, cat, def);
	}

	override applyConditioning(str: string): string {
		return Parser.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		if (kw.getArg(0).includes("'"))
			throw new InputErrorException(tr(Input.INP_ERR_QUOTE));
		this.value = kw.getArg(0);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_STRING);
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

	override getReturnType(): OutputReturnType | null {
		return "String";
	}

}
