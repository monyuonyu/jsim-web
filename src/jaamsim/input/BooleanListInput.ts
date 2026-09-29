import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import type { BooleanVector } from "../datatypes/BooleanVector.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import { ListInput } from "./ListInput.ts";

export class BooleanListInput extends ListInput<BooleanVector> {

	constructor(key: string, cat: string, def: BooleanVector | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCountRange(kw, this.minCount, this.maxCount);
		this.value = Input.parseBooleanVector(kw);
	}

	override getListSize(): number {
		const val = this.getValue();
		if (val === null)
			return 0;
		else
			return val.size();
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.size() === 0)
			return "";

		let tmp = "";
		for (let i = 0; i < this.defValue.size(); i++) {
			if (i > 0) tmp += Input.SEPARATOR;

			if (this.defValue.get(i))
				tmp += "TRUE";
			else
				tmp += "FALSE";
		}
		return tmp;
	}
}
