/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2014 Ausenco Engineering Canada Inc.
 * Copyright (C) 2016-2023 JaamSim Software Inc.
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

import { ClassRegistry } from "../java/ClassRegistry.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { EventManager } from "../events/EventManager.ts";
import { AssignmentListInput } from "../input/AssignmentListInput.ts";
import type { ExpParser_Assignment } from "../input/ExpParser.ts";
import { LinkedComponent } from "./LinkedComponent.ts";

/**
 * Assigns values to Attributes.
 * @author Harry King
 *
 */
export class Assign extends LinkedComponent {

	private readonly assignmentList: AssignmentListInput;

	constructor() {
		super();
		this.assignmentList = new AssignmentListInput("AttributeAssignmentList", Entity.KEY_INPUTS, [] as ExpParser_Assignment[]);
		this.setKeywordDoc(this.assignmentList, "A list of attribute assignments that are triggered when an entity is "
		                     + "received."
		                     + "\n\n"
		                     + "The attributes for various entities can be used in an assignment "
		                     + "expression:\n"
		                     + "- this entity -- this.AttributeName\n"
		                     + "- entity received -- this.obj.AttributeName\n"
		                     + "- another entity -- [EntityName].AttributeName", []);
		this.assignmentList.setRequired(true);
		this.addInput(this.assignmentList);
	}

	override addEntity(ent: DisplayEntity): void {
		super.addEntity(ent);

		// Evaluate the assignment expressions
		this.assignmentList.executeAssignments(this, EventManager.simSeconds());

		// Pass the entity to the next component
		this.sendToNextComponent(ent);
	}

}

ClassRegistry.register("com.jaamsim.ProcessFlow.Assign", Assign);
