/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2011 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2025 JaamSim Software Inc.
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
import { DisplayModel } from "../internal.ts";
import { BooleanInput } from "../internal.ts";
import { ClassInput } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { ImageInput } from "../internal.ts";
import type { Input } from "../input/Input.ts";
import { InputCallback } from "../internal.ts";
import { StringInput } from "../internal.ts";
import { Vec3dInput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import type { JClass } from "../java/lang.ts";
import { Vec3d } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import { Entity } from "../internal.ts";

/**
 * Java は com.jaamsim.ui.DragAndDropable を実装している（画面の部品なので interface は移さず、関数だけを残した）。
 */
export class ObjectType extends Entity {

	private readonly javaClass: ClassInput;

	private readonly palette: StringInput;

	private readonly defaultDisplayModel: EntityInput<DisplayModel>;

	private readonly dragAndDrop: BooleanInput;

	private readonly iconFile: ImageInput;

	private readonly defaultSize: Vec3dInput;

	private readonly defaultAlignment: Vec3dInput;

	private readonly displayEntityDefault: DisplayModel[] = [];

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.active.setDefaultValue(false);

		this.javaClass = new ClassInput( "JavaClass", Entity.KEY_INPUTS, null );
		this.setKeywordDoc(this.javaClass, "The java class of the object type",
				["This is placeholder example text"]);
		this.javaClass.setCallback(ObjectType.javaclassCallback);
		this.addInput( this.javaClass );

		this.palette = new StringInput("Palette", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.palette, "The package to which the object type belongs",
				["This is placeholder example text"]);
		this.addInput( this.palette );

		this.defaultDisplayModel = new EntityInput<DisplayModel>(DisplayModel, "DefaultDisplayModel", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.defaultDisplayModel, "Only for DisplayEntity", []);
		this.defaultDisplayModel.setCallback(ObjectType.displaymodelCallback);
		this.addInput(this.defaultDisplayModel);

		this.dragAndDrop = new BooleanInput("DragAndDrop", Entity.KEY_INPUTS, true);
		this.setKeywordDoc(this.dragAndDrop, "This is placeholder description text", []);
		this.addInput(this.dragAndDrop);

		this.iconFile = new ImageInput("IconFile", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.iconFile, "The (optional) image to be used in the Model Builder as the icon for "
				+ "this object type.  The normal image size is 24x24 pixels.",
				["This is placeholder example text"]);
		this.addInput(this.iconFile);

		this.defaultSize = new Vec3dInput("DefaultSize", Entity.KEY_INPUTS, new Vec3d(1.0, 1.0, 1.0));
		this.setKeywordDoc(this.defaultSize, "The default size for the instances of this class.",
				["1.0 1.0 1.0 m"]);
		this.defaultSize.setUnitType(DistanceUnit);
		this.addInput(this.defaultSize);

		this.defaultAlignment = new Vec3dInput("DefaultAlignment", Entity.KEY_INPUTS, new Vec3d(0.0, 0.0, 0.0));
		this.setKeywordDoc(this.defaultAlignment, "The default alignment for the instances of this class.",
				["0.0 0.0 -0.5"]);
		this.addInput(this.defaultAlignment);
	}

	static readonly javaclassCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, _inp: Input<any>): void {
			(ent as ObjectType).updatejavaclassCallback();
		}
	})();

	updatejavaclassCallback(): void {
		this.getJaamSimModel().addObjectType(this);
	}

	static readonly displaymodelCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, _inp: Input<any>): void {
			(ent as ObjectType).updatedisplaymodelCallback();
		}
	})();

	updatedisplaymodelCallback(): void {
		this.displayEntityDefault.length = 0;
		if (this.defaultDisplayModel.getValue() != null)
			this.displayEntityDefault.push(this.defaultDisplayModel.getValue() as DisplayModel);
	}

	override kill(): void {
		super.kill();
		this.getJaamSimModel().removeObjectType(this);
	}

	getJavaClass(): JClass<Entity> | null {
		return this.javaClass.getValue() as JClass<Entity> | null;
	}

	getLibraryName(): string {
		const s = this.palette.getValue() as string | null;
		if (s != null)
			return s;

		return "Default";
	}

	getDefaultDisplayModel(): DisplayModel[] {
		return this.displayEntityDefault;
	}

	isDragAndDrop(): boolean {
		return this.dragAndDrop.getValue() as boolean;
	}

	/** Java は BufferedImage を返す。描画: 省略（ImageInput の値をそのまま返す） */
	getIconImage(): unknown {
		return this.iconFile.getValue();
	}

	getDefaultSize(): Vec3d {
		return this.defaultSize.getValue() as Vec3d;
	}

	getDefaultAlignment(): Vec3d {
		return this.defaultAlignment.getValue() as Vec3d;
	}

}

ClassRegistry.register("com.jaamsim.basicsim.ObjectType", ObjectType);
