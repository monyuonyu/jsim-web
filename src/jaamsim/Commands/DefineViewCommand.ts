/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2017-2026 JaamSim Software Inc.
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

import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import type { IntegerVector } from "../datatypes/IntegerVector.ts";
import { View } from "../Graphics/View.ts";
import { tr } from "../i18n/I18n.ts";
import { InputAgent } from "../input/InputAgent.ts";
import { jformat } from "../java/lang.ts";
import type { Vec3d } from "../math/Vec3d.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import type { Command } from "./Command.ts";

export class DefineViewCommand implements Command {

	private readonly simModel: JaamSimModel;
	private view: View | null;
	private readonly viewName: string;
	private readonly viewPosition: Vec3d | null;
	private readonly viewDirection: Vec3d | null;
	private readonly windowPos: IntegerVector | null;

	constructor(sim: JaamSimModel, str: string, viewPos: Vec3d | null, viewDir: Vec3d | null, winPos: IntegerVector | null) {
		this.simModel = sim;
		this.view = null;
		this.viewName = str;
		this.viewPosition = viewPos;
		this.viewDirection = viewDir;
		this.windowPos = winPos;
	}

	execute(): void {

		// Create the new view
		this.view = InputAgent.defineEntityWithUniqueName(this.simModel, View, null, this.viewName, "", true);
		this.simModel.setSessionEdited(true);
		const view = this.view!;

		// Position the window on the screen
		if (this.windowPos != null) {
			InputAgent.applyIntegers(view, "WindowPosition", this.windowPos.get(0), this.windowPos.get(1));
		}

		// Display the window
		// 描画: 省略（three.js の画面を作るときに）RenderManager.inst().createWindow(view)・FrameBox.setSelectedEntity(view, false)
		InputAgent.applyArgs(view, "ShowWindow", "TRUE");

		// Set the camera position
		if (this.viewPosition != null) {
			InputAgent.applyVec3d(view, "ViewPosition", this.viewPosition, DistanceUnit);
		}
		if (this.viewDirection != null) {
			InputAgent.applyVec3d(view, "ViewDirection", this.viewDirection, DistanceUnit);
		}
	}

	undo(): void {
		this.view!.kill();
		this.simModel.setSessionEdited(true);
	}

	tryMerge(_cmd: Command): Command | null {
		return null;
	}

	isChange(): boolean {
		return true;
	}

	tryRepeat(_ent: Entity | null): Command | null {
		return null;
	}

	toString(): string {
		return jformat(tr("New View: '%s'"), this.viewName);
	}

}
