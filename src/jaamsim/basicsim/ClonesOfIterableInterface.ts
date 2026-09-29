/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2019 JaamSim Software Inc.
 * TypeScript への移植 (C) 2026 shota
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { jIsAssignableFrom } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import type { Entity } from "./Entity.ts";
import { EntityIterator } from "./EntityIterator.ts";
import type { JaamSimModel } from "./JaamSimModel.ts";

/**
 * Java では interface の Class を受けるが、TS の interface は実行時に無いので、
 * 実体を調べる判定の関数（例: isRandomStreamUser）を受ける。
 */
export class ClonesOfIterableInterface<T extends Entity> extends EntityIterator<T> {
	private readonly ifaceClass: (o: unknown) => boolean;
	constructor(simModel: JaamSimModel, aClass: JClass<T>, iface: (o: unknown) => boolean) {
		super(simModel, aClass);
		this.ifaceClass = iface;
	}

	override matches(entklass: JClass | null, ent: Entity): boolean {
		return jIsAssignableFrom(this.entClass, entklass) && this.ifaceClass(ent);
	}
}
