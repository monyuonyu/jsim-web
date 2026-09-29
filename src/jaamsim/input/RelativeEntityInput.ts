import { EntityProvConstant } from "../EntityProviders/EntityProvConstant.ts";
import { EntityProvInput } from "../EntityProviders/EntityProvInput.ts";
import type { EntityProvider } from "../EntityProviders/EntityProvider.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { EntityLabel } from "../Graphics/EntityLabel.ts";
import { OverlayEntity } from "../Graphics/OverlayEntity.ts";
import { Region } from "../Graphics/Region.ts";
import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class RelativeEntityInput extends EntityProvInput<DisplayEntity> {
	constructor(key: string, cat: string, def: EntityProvider<DisplayEntity> | null) {
		super(DisplayEntity, key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const temp = Input.parseEntityProvider(kw, thisEnt, DisplayEntity);
		if (temp instanceof EntityProvConstant) {
			const ent = temp.getNextEntity(thisEnt, 0.0);
			if (RelativeEntityInput.isCircular(thisEnt, ent)) {
				throw new InputErrorException(tr("The assignment of %s to RelativeEntity would create a circular loop."), ent);
			}
		}
		this.setValid(true);
		this.value = temp;
	}

	private static isCircular(thisEnt: Entity, e: DisplayEntity | null): boolean {
		let ent = e;
		while (ent !== null) {
			if (ent === thisEnt)
				return true;
			ent = ent.getRelativeEntity();
		}
		return false;
	}

	override getValidOptions(ent: Entity): string[] {
		const list: string[] = [];
		const simModel = ent.getJaamSimModel();
		for (const each of simModel.getClonesOfIterator(DisplayEntity)) {
			if (each.isGenerated())
				continue;

			if (each instanceof OverlayEntity || each instanceof Region || each instanceof EntityLabel)
				continue;

			if (RelativeEntityInput.isCircular(ent, each))
				continue;

			list.push(each.getName());
		}
		list.sort((a, b) => Input.uiSortOrder.compare(a, b));
		return list;
	}

}
