/*
 * JaamSim Discrete Event Simulation
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

import { Double, jformat } from "../java/lang.ts";
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";

export class ProcessorData {

	private numberReceived = 0;     // Number of entities received after initialisation
	private numberProcessed = 0; // Number of entities processed after initialisation
	private initialNumberReceived = 0;     // Number of entities received during initialisation
	private initialNumberProcessed = 0; // Number of entities processed during initialisation
	private receivedEntity: DisplayEntity | null = null; // Entity received most recently
	private releaseTime = Double.NaN;

	constructor() {}

	clear(): void {
		this.numberReceived = 0;
		this.numberProcessed = 0;
		this.initialNumberReceived = 0;
		this.initialNumberProcessed = 0;
		this.receivedEntity = null;
		this.releaseTime = Double.NaN;
	}

	clearStatistics(): void {
		this.initialNumberReceived = this.numberReceived;
		this.initialNumberProcessed = this.numberProcessed;
		this.numberReceived = 0;
		this.numberProcessed = 0;
	}

	receiveEntity(ent: DisplayEntity | null): void {
		this.receivedEntity = ent;
		this.numberReceived++;
	}

	releaseEntity(simTime: number): void {
		this.numberProcessed++;
		this.releaseTime = simTime;
	}

	setReceivedEntity(ent: DisplayEntity | null): void {
		this.receivedEntity = ent;
	}

	/**
	 * Returns the last entity that was received.
	 * @return last entity received
	 */
	getReceivedEntity(): DisplayEntity | null {
		return this.receivedEntity;
	}

	/**
	 * Returns the time at which the last entity was released.
	 * @return last release time
	 */
	getReleaseTime(): number {
		return this.releaseTime;
	}

	/**
	 * Returns the number of entities that have been received from upstream during the entire
	 * simulation run, including the initialisation period.
	 * @return total number of entities that were added
	 */
	getTotalNumberReceived(): number {
		return this.initialNumberReceived + this.numberReceived;
	}

	/**
	 * Returns the number of entities that have been passed downstream during the entire
	 * simulation run, including the initialisation period.
	 * @return total number of entities that were processed
	 */
	getTotalNumberProcessed(): number {
		return this.initialNumberProcessed + this.numberProcessed;
	}

	/**
	 * Returns the number of entities that have been received from upstream after the
	 * initialisation period.
	 * @return number of entities that were added
	 */
	getNumberReceived(): number {
		return this.numberReceived;
	}

	/**
	 * Returns the number of entities that have been passed downstream after the
	 * initialisation period.
	 * @return number of entities that were processed
	 */
	getNumberProcessed(): number {
		return this.numberProcessed;
	}

	/**
	 * Returns the number of entities that have been received but whose processing has not been
	 * completed yet.
	 * @return number of entities that being processed
	 */
	getNumberInProgress(): number {
		return  this.initialNumberReceived + this.numberReceived - this.initialNumberProcessed - this.numberProcessed;
	}

	toString(): string {
		return jformat("(%s, %s, %s, %s, [%s], %.6f[s])",
				this.numberReceived, this.numberProcessed, this.initialNumberReceived, this.initialNumberProcessed,
				this.receivedEntity, this.releaseTime);
	}

}
