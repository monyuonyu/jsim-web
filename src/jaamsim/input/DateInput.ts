// 注（多重定義の扱い）:
// - getValue() と getValue(thisEnt, simTime, klass) は、引数の数で見分けて 1 つにした（Input.ts と同じ）。
import type { Entity } from "../basicsim/Entity.ts";
import { SimDate } from "../basicsim/SimDate.ts";
import { tr } from "../i18n/I18n.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import type { Unit } from "../units/Unit.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";
import { Parser } from "./Parser.ts";

export class DateInput extends Input<SimDate> {

	constructor(key: string, cat: string, def: SimDate | null) {
		super(key, cat, def);
	}

	override applyConditioning(str: string): string {
		return Parser.addQuotesIfNeeded(str);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const temp = Input.parseRFC8601Date(kw.getArg(0));
		this.value = new SimDate(temp[0], temp[1], temp[2], temp[3], temp[4], temp[5], temp[6]);
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_DATE);
	}

	override getValue(): SimDate | null;
	override getValue<V>(thisEnt: Entity, simTime: number, klass: JClass<V> | OutputReturnType | null): V | null;
	override getValue(thisEnt?: Entity, simTime?: number, klass?: unknown): unknown {
		if (thisEnt === undefined)
			return super.getValue();
		// Java では値が null なら NullPointerException（ここでも TypeError になる）
		return (this.getValue() as SimDate).toArray();
	}

	override getReturnType(): OutputReturnType | null {
		return "int[]";
	}

	override getUnitType(): JClass<Unit> | null {
		return DimensionlessUnit;
	}

}
