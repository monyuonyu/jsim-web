import type { Entity } from "../basicsim/Entity.ts";
import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Input } from "./Input.ts";
import { InputAgent } from "./InputAgent.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

export class EntityNameInput extends Input<string> {

	constructor(key: string, cat: string, def: string | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		Input.assertCount(kw, 1);

		const localName = kw.getArg(0);
		if (!this.isDef) {

			// Check that the entity was defined AFTER the RecordEdits command
			if (!thisEnt.isAdded())
				throw new InputErrorException(tr("Cannot rename an entity that was defined before the "
						+ "RecordEdits command."));

			// Check that the new name is valid
			if (!InputAgent.isValidName(localName))
				throw new InputErrorException(tr(InputAgent.INP_ERR_BADNAME), localName);

			// Get the new absolute name
			let name = localName;
			const parent = thisEnt.getParent();
			if (parent !== null)
				name = parent.getName() + "." + localName;

			// Check that the new absolute name does not conflict with another entity
			const ent = thisEnt.getJaamSimModel().getNamedEntity(name);
			if (ent !== null && ent !== thisEnt)
				throw new InputErrorException(tr(InputAgent.INP_ERR_DEFINEUSED), name,
						ClassRegistry.simpleName(ent));
		}

		this.value = localName;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_ENTITY_NAME);
	}

	override isEdited(): boolean {
		// Name inputs are not saved to the configuration file
		return false;
	}

	setInitialValue(name: string): void {
		this.value = name;
		this.valueTokens = [name];
		this.isDef = false;
	}

}
