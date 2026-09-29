/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2021 JaamSim Software Inc.
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
import type { JaamSimModel } from "./JaamSimModel.ts";

export interface RunListener {

	/**
	 * Notifies that the specified simulation run has finished execution.
	 * @param run - simulation run that has been completed
	 */
	runEnded(): void;

	/**
	 * Called when a runtime error is encountered during the model run. An EventManager context is available
	 * as this will always be called from a model process.
	 * @param sm - the model where the error was encountered
	 * @param t - error condition
	 */
	handleRuntimeError(sm: JaamSimModel, t: unknown): void;

}
