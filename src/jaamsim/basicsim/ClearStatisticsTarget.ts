import { ProcessTarget } from "../events/ProcessTarget.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

export class ClearStatisticsTarget extends ProcessTarget {
	readonly simModel: JaamSimModel;

	constructor(model: JaamSimModel) {
		super();
		this.simModel = model;
	}

	override getDescription(): string {
		return "Simulation.clearStatistics";
	}

	override process(): void {
		this.simModel.event_clearStatistics();
	}

}
