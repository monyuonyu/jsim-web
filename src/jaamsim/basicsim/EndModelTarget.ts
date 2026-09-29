import { ProcessTarget } from "../events/ProcessTarget.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

export class EndModelTarget extends ProcessTarget {
	readonly simModel: JaamSimModel;

	constructor(model: JaamSimModel) {
		super();
		this.simModel = model;
	}

	override getDescription(): string {
		return "Simulation.end";
	}

	override process(): void {
		this.simModel.event_end();
	}
}
