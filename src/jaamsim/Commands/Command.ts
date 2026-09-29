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

export interface Command {

	/**
	 * Performs the change to the model.
	 */
	execute(): void;

	/**
	 * Reverses the change to the model.
	 */
	undo(): void;

	/**
	 * Attempts to merge this command with the specified command.
	 * @param cmd - command to merge
	 * @return merged command or null if commands are incompatible
	 */
	tryMerge(cmd: Command): Command | null;

	/**
	 * Returns whether the command changes any inputs.
	 * @return true if one or more inputs are changed
	 */
	isChange(): boolean;

	/**
	 * Attempts to apply this command to a different entity.
	 * @param cmd - command to repeat
	 * @return repeated command or null if the command is incompatible with the new entity
	 */
	tryRepeat(ent: Entity | null): Command | null;
}
