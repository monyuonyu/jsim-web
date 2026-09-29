// 注（多重定義の扱い）:
// - private の isValid(T ent) は、基底の isValid()（入力が有効か）と名前がぶつかるので isValidEntity にした。
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { jformat, jIsAssignableFrom } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";
import type { OutputReturnType } from "./OutputRegistry.ts";

export class EntityInput<T extends Entity> extends Input<T> {

	private entClass: JClass<T>;
	private entSubClass: JClass<T> | null;  // a particular sub-class that can be set at runtime
	private includeSubclasses: boolean;  // flag to determine if subclasses are valid
	private invalidClasses: JClass<Entity>[]; // list of invalid classes (including subclasses).  if empty, then all classes are valid

	constructor(aClass: JClass<T>, key: string, cat: string, def: T | null) {
		super(key, cat, def);
		this.entClass = aClass;
		this.entSubClass = aClass;
		this.includeSubclasses = true;
		this.invalidClasses = [];
	}

	setSubClass(aClass: JClass<T> | null): void {
		if (aClass !== this.entSubClass)
			this.reset();
		this.entSubClass = aClass;
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const tmp = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), this.entClass);
		if (!this.isValidEntity(tmp))
			throw new InputErrorException(tr("%s is not a valid entity"), tmp.getName());
		this.value = tmp;
	}

	override getValidInputDesc(): string {
		if (this.entClass === (DisplayEntity as unknown as JClass<T>)) {
			return tr(Input.VALID_ENTITY);
		}
		return jformat(tr(Input.VALID_ENTITY_TYPE), ClassRegistry.simpleName(this.entClass));
	}

	override getExamples(): string[] {
		let name = ClassRegistry.simpleName(this.entClass);
		if (this.entClass === (DisplayEntity as unknown as JClass<T>)) {
			name = "Entity";
		}
		return [name+"1"];
	}

	override getValidOptions(ent: Entity): string[] | null {
		const list: string[] = [];
		if (this.entSubClass === null)
			return list;

		for (const each of ent.getJaamSimModel().getClonesOfIterator(this.entSubClass)) {
			if (!each.isRegistered())
				continue;

			if (!this.isValidEntity(each))
				continue;

			list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		toks.push(this.value.getName());
	}

	/** Java の private isValid(T ent)（基底の isValid() とぶつかるので名前を変えた） */
	private isValidEntity(ent: T): boolean {
		if(! this.includeSubclasses) {
			if( ent.constructor !== this.entClass ) {
				return false;
			}
		}

		for( const c of this.invalidClasses ) {
			if( jIsAssignableFrom( c, ent.constructor as JClass ) ) {
				return false;
			}
		}

		return true;
	}

	setIncludeSubclasses(bool: boolean): void {
		this.includeSubclasses = bool;
	}

	addInvalidClass(aClass: JClass<Entity>): void {
		this.invalidClasses.push(aClass);
	}

	override removeReferences(ent: Entity): boolean {
		if (this.value === ent) {
			this.reset();
			return true;
		}
		return false;
	}

	override appendEntityReferences(list: Entity[]): void {
		if (this.value === null || list.includes(this.value))
			return;
		list.push(this.value);
	}

	override getReturnType(): OutputReturnType | null {
		return "Entity";
	}

}
