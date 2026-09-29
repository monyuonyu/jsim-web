import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { tr } from "../i18n/I18n.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";


export class BooleanInput extends Input<boolean> {

	static readonly TRUE = "TRUE";
	static readonly FALSE = "FALSE";

	// Java の static の初期化ブロック
	static readonly validOptions: string[] = [BooleanInput.TRUE, BooleanInput.FALSE];

	/**
	 * Creates a new Boolean Input with the given keyword, category, units, and
	 * default value.
	 */
	constructor(key: string, cat: string, def: boolean) {
		super(key, cat, def);
	}

	override applyConditioning(str: string): string {
		if (str.startsWith("t") || str.startsWith("T") || str.startsWith("1"))
			return BooleanInput.TRUE;
		if (str.startsWith("f") || str.startsWith("F") || str.startsWith("0"))
			return BooleanInput.FALSE;
		return str;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		this.value = Input.parseBoolean(kw.getArg(0));
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_BOOLEAN);
	}

	override getExamples(): string[] {
		return Input.EXAMPLE_BOOLEAN;
	}

	override getValidOptions(ent: Entity | null): string[] | null {
		return BooleanInput.validOptions;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null)
			return "";

		if (this.defValue)
			return BooleanInput.TRUE;

		return BooleanInput.FALSE;
	}

	override getReturnType(): OutputReturnType | null {
		return "boolean";
	}

	override getUnitType(): JClass<Unit> | null {
		return DimensionlessUnit;
	}
}
