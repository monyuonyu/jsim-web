import { SampleInput } from "../Samples/SampleInput.ts";
import { EventManager } from "../events/EventManager.ts";
import { ProcessTarget } from "../events/ProcessTarget.ts";
import { EntityListInput } from "../input/EntityListInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double } from "../java/lang.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { Entity } from "./Entity.ts";

export class EntityTracer extends Entity {

	private readonly startTime: SampleInput;

	private readonly entities: EntityListInput<Entity>;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.startTime = new SampleInput("StartTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.startTime, "The time at which to start tracing Entities",
				["500 h"]);
		this.startTime.setUnitType(TimeUnit);
		this.startTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.addInput(this.startTime);

		this.entities = new EntityListInput<Entity>(Entity, "Entities", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.entities, "The Entities to trace", []);
		this.addInput(this.entities);
	}

	override startUp(): void {
		super.startUp();

		if ((this.entities.getValue() as Entity[]).length === 0 || this.startTime.getNextSample(this, 0.0) === 0.0)
			return;

		// Java は EventManager.waitSeconds で待ってから、続きを実行する（スレッドで待つ）。
		// 待つ書き方は無いので、同じ時刻・同じ優先度・LIFO で続きを予約する。
		// TODO(移植): Java の waitSeconds は予約した事象の説明が違う（事象の記録・照合の結果が変わる）
		const entities = this.entities;
		EventManager.scheduleSeconds(this.startTime.getNextSample(this, 0.0), Entity.PRI_HIGHEST, Entity.EVT_LIFO,
				new (class extends ProcessTarget {
					override getDescription(): string { return "EntityTracer.startUp"; }
					override process(): void {
						for (const each of entities.getValue() as Entity[])
							each.setTraceFlag();
					}
				})(), null);
	}
}

ClassRegistry.register("com.jaamsim.basicsim.EntityTracer", EntityTracer);
