import { ProcessTarget } from "../events/ProcessTarget.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

export class InitModelTarget extends ProcessTarget {
	readonly simModel: JaamSimModel;

	constructor(model: JaamSimModel) {
		super();
		this.simModel = model;
	}

	override getDescription(): string {
		return "Simulation.init";
	}

	override process(): void {
		this.simModel.event_init();
	}
}
