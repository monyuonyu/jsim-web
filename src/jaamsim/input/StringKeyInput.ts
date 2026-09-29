import type { Entity } from "../basicsim/Entity.ts";
import type { JClass } from "../java/lang.ts";
import { Input } from "./Input.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

// TODO(順番): Java は HashMap。Map は入れた順に回るので、値を順に回す所（toString など）は Java と順番が違う
export class StringKeyInput<T extends Entity> extends Input<Map<string, T | null>> {

	private entClass: JClass<T>;

	constructor(klass: JClass<T>, keyword: string, cat: string) {
		super(keyword, cat, null);
		this.entClass = klass;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const hashMap = new Map<string, T | null>();
		const subArgs = kw.getSubArgs();
		for (let i = 0; i < subArgs.length; i++) {
			const subArg = subArgs[i];
			Input.assertCount(subArg, 2);
			const ent = Input.tryParseEntity(thisEnt.getJaamSimModel(), subArg.getArg(1), this.entClass );
			hashMap.set(subArg.getArg(0), ent);
		}
		this.value = hashMap;
	}

	getValueFor(str: string): T | null {
		const val = this.getValue();
		if (val === null)
			return null;
		return val.get(str) ?? null;
	}

}
