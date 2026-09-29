// 注（多重定義の扱い）:
// - Java は reset(Entity) だけを上書きしている。reset(ent?) の 1 つにし、ent が無ければ基底の reset() と同じ。
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { EntityLabel } from "../Graphics/EntityLabel.ts";
import { OverlayEntity } from "../Graphics/OverlayEntity.ts";
import { Region } from "../Graphics/Region.ts";
import { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { EntityInput } from "./EntityInput.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class ParentEntityInput extends EntityInput<Entity> {

	constructor(key: string, cat: string, def: Entity | null) {
		super(Entity, key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);
		const tmp: Entity | null = Input.parseEntity(thisEnt.getJaamSimModel(), kw.getArg(0), Entity);
		if (tmp === null)
			throw new InputErrorException(tr(Input.INP_ERR_ENTNAME), tmp);

		const localName = thisEnt.getLocalName() as string;
		if (tmp.getChild(localName) !== null)
			throw new InputErrorException(tr("Entity %s already has a child entity named %s.%n"
					+ "Change the new child's name before assigning it to this parent entity."),
					tmp, localName);

		if (ParentEntityInput.isCircular(thisEnt, tmp))
			throw new InputErrorException(tr("The assignment of %s to Parent would create a circular loop."), tmp);
		this.value = tmp;
	}

	private static isCircular(thisEnt: Entity, e: Entity | null): boolean {
		let ent = e;
		while (ent !== null) {
			if (ent === thisEnt)
				return true;
			ent = ent.getParent();
		}
		return false;
	}

	override getValidOptions(ent: Entity): string[] | null {
		const list: string[] = [];
		for (const each of ent.getJaamSimModel().getClonesOfIterator(DisplayEntity)) {
			if (!each.isRegistered())
				continue;

			if (each instanceof OverlayEntity || each instanceof Region || each instanceof EntityLabel)
				continue;

			if (ParentEntityInput.isCircular(ent, each))
				continue;

			if (each !== ent.getParent() && each.getChild(ent.getLocalName() as string) !== null)
				continue;

			list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

	override isEdited(): boolean {
		// Parent name inputs are not saved to the configuration file
		return false;
	}

	setInitialValue(newParent: Entity | null): void {
		this.value = newParent;
		let name = "";
		if (newParent !== null)
			name = newParent.getName();
		this.valueTokens = [name];
		this.isDef = false;
	}

	override reset(ent?: Entity): void {
		if (ent === undefined) {
			super.reset();
			return;
		}
		const localName = ent.getLocalName() as string;
		if (ent.getParent() !== null && ent.getJaamSimModel().getEntity(localName) !== null)
			throw new InputErrorException(tr("Entity named %s already exists.%n"
					+ "Change the entity's name before deleting its 'Parent' input."),
					localName);
		super.reset();
	}

}
