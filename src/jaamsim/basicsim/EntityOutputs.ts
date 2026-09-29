/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2002-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2026 JaamSim Software Inc.
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

/*
 * Entity の出力（Java の Entity の @Output）。Entity.ts から分けた:
 * 単位のクラス（TimeUnit など）は Entity を継承するので、Entity.ts の読み込みの時点で TimeUnit を使うと輪になる。
 */
import { Entity } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { TimeUnit } from "../internal.ts";

defineOutput(Entity, {
	name: "Name",
	description: "The unique input name for this entity.",
	sequence: 0,
	returnType: "String",
	get: (e, simTime) => e.getNameOutput(simTime),
});

defineOutput(Entity, {
	name: "ObjectType",
	description: "The class of objects that this entity belongs to.",
	sequence: 1,
	returnType: "Entity",
	get: (e, simTime) => e.getObjectTypeName(simTime),
});

defineOutput(Entity, {
	name: "SimTime",
	description: "The present simulation time.",
	unitType: TimeUnit,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getSimTime(simTime),
});

defineOutput(Entity, {
	name: "Parent",
	description: "The parent entity for this entity.",
	sequence: 3,
	returnType: "Entity",
	get: (e, simTime) => e.getParentOutput(simTime),
});

defineOutput(Entity, {
	name: "Children",
	description: "List of entities whose parent is this entity.",
	sequence: 4,
	returnType: "ArrayList",
	get: (e, simTime) => e.getChildrenOutput(simTime),
});

defineOutput(Entity, {
	name: "Prototype",
	description: "The entity that provides the default inputs for this entity.",
	sequence: 5,
	returnType: "Entity",
	get: (e, simTime) => e.getPrototypeOutput(simTime),
});

defineOutput(Entity, {
	name: "CloneList",
	description: "List of entities whose prototype is this entity.",
	sequence: 6,
	returnType: "ArrayList",
	get: (e, simTime) => e.getCloneListOutput(simTime),
});

