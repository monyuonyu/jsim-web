import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { tr } from "../i18n/I18n.ts";
import { Integer } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class IntegerInput extends Input<number> {
	private minValue = Integer.MIN_VALUE;
	private maxValue = Integer.MAX_VALUE;

	constructor(key: string, cat: string, def: number | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		this.value = Input.parseInteger(kw.getArg(0), this.minValue, this.maxValue);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_INTEGER);
	}

	setValidRange(min: number, max: number): void {
		this.minValue = min;
		this.maxValue = max;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null)
			return "";

		if (this.defValue === Integer.MAX_VALUE)
			return Input.POSITIVE_INFINITY;

		if (this.defValue === Integer.MIN_VALUE)
			return Input.NEGATIVE_INFINITY;

		const tmp = String(this.defValue);

		return tmp;
	}

	override getReturnType(): OutputReturnType | null {
		return "int";
	}

	override getUnitType(): JClass<Unit> | null {
		return DimensionlessUnit;
	}

	override isIntegerValue(): boolean {
		return true;
	}
}
