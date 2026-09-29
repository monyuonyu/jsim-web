/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2010-2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2022 JaamSim Software Inc.
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
 *
 * TypeScript への移植 (C) 2026 shota
 */
import { Integer } from "../java/lang.ts";
import { Input } from "./Input.ts";

export abstract class ListInput<T> extends Input<T> {
	protected minCount = 0;
	protected maxCount = Integer.MAX_VALUE;

	constructor(key: string, cat: string, def: T | null) {
		super(key, cat, def);
		// Java の初期化ブロック
		this.minCount = 0;
		this.maxCount = Integer.MAX_VALUE;
	}

	setValidCount(count: number): void {
		this.setValidCountRange(count, count);
	}

	setValidCountRange(min: number, max: number): void {
		this.minCount = min;
		this.maxCount = max;
	}

	/**
	 * Returns the number of individual values that were entered to the input or were inherited
	 * from its prototype.
	 * @return number of values
	 */
	abstract getListSize(): number;
}
