import { EventManager } from "../events/EventManager.ts";
import { ProcessTarget } from "../events/ProcessTarget.ts";
import type { Conditional } from "../events/Conditional.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

// 入れ子のクラス PauseModelTarget.PauseModelCondition は、同じファイルの PauseModelTarget_PauseModelCondition にした
export class PauseModelTarget extends ProcessTarget {
	readonly simModel: JaamSimModel;
	readonly condition: Conditional;

	constructor(model: JaamSimModel) {
		super();
		this.simModel = model;
		this.condition = new PauseModelTarget_PauseModelCondition(model);
	}

	override getDescription(): string {
		return "Simulation.pause";
	}

	override process(): void {
		this.simModel.event_pause();
	}
}

class PauseModelTarget_PauseModelCondition implements Conditional {
	readonly simModel: JaamSimModel;

	constructor(model: JaamSimModel) {
		this.simModel = model;
	}

	evaluate(): boolean {
		const simTime = EventManager.simSeconds();
		return this.simModel.getSimulation()!.isPauseConditionSatisfied(simTime);
	}
}
