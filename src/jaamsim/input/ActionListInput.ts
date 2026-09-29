/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2021-2022 JaamSim Software Inc.
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
// 注（移植）: Java の com.jaamsim.render.Action.Binding（描画の部品の中の入れ子のクラス）は、描画を移さないので
// このファイルの Action_Binding にした。入力の値（アクションの名前と出力の名前）は、モデルのファイルが読めるように移す。
import type { Entity } from "../basicsim/Entity.ts";
import type { JaamSimModel } from "../basicsim/JaamSimModel.ts";
import { tr } from "../i18n/I18n.ts";
import { ArrayListInput } from "./ArrayListInput.ts";
import { Input } from "./Input.ts";
import { InputErrorException } from "./InputErrorException.ts";
import type { KeywordIndex } from "./KeywordIndex.ts";

/**
 * Java の com.jaamsim.render.Action.Binding。
 * TODO(移植): render/Action.ts を作るときは、そちらへ移す。
 */
export class Action_Binding {
	actionName: string | null = null;
	outputName: string | null = null;
}

export class ActionListInput extends ArrayListInput<Action_Binding>{

	constructor(key: string, cat: string, def: Action_Binding[] | null) {
		super(key, cat, def);
	}

	/** @throws InputErrorException */
	override parse(thisEnt: Entity, kw: KeywordIndex): void {
		const subArgs = kw.getSubArgs();
		const bindings: Action_Binding[] = [];
		for (let i = 0; i < subArgs.length; i++) {
			try {
				bindings.push(this.parseBinding(subArgs[i]));
			} catch (e) {
				if (!(e instanceof InputErrorException))
					throw e;
				// Java も i+1 ではなく i を渡している
				throw new InputErrorException(tr(Input.INP_ERR_ELEMENT), i, e.getMessage());
			}
		}
		this.value = bindings;
	}

	/** @throws InputErrorException */
	private parseBinding(kw: KeywordIndex): Action_Binding {
		Input.assertCount(kw, 2);
		const binding = new Action_Binding();
		binding.actionName = kw.getArg(0);
		binding.outputName = kw.getArg(1);
		return binding;
	}

	override getValidInputDesc(): string {
		return tr(Input.VALID_ACTION);
	}

	override getValueTokens(toks: string[]): void {
		if (this.value === null || this.isDef)
			return;

		for (let i = 0; i < this.value.length; i++) {
			const b = this.value[i];
			toks.push("{");
			toks.push(b.actionName as string);
			toks.push(b.outputName as string);
			toks.push("}");
		}
	}

	override useExpressionBuilder(): boolean {
		return true;
	}

	override getDefaultString(simModel: JaamSimModel | null): string {
		if (this.defValue === null || this.defValue.length === 0)
			return "";

		let tmp = "";
		for (let i = 0; i < this.defValue.length; i++) {
			// Separate each action
			if (i > 0) tmp += Input.SEPARATOR;

			// Java も defValue ではなく value を読んでいる（value が null なら NullPointerException）
			const b = (this.value as Action_Binding[])[i];
			tmp += "{ ";
			tmp += String(b.actionName);
			tmp += Input.SEPARATOR;
			tmp += String(b.outputName);
			tmp += " }";
		}
		return tmp;
	}
}
