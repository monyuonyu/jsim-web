//@@HEADER@@
import type { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { LateClasses } from "../Graphics/LateClasses.ts";
import type { View } from "../Graphics/View.ts";
import { Entity } from "../basicsim/Entity.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { EntityListInput } from "../input/EntityListInput.ts";
import type { Input } from "../input/Input.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { ValueListInput } from "../input/ValueListInput.ts";
import { Vec3dInput } from "../input/Vec3dInput.ts";
import { Double } from "../java/lang.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";

/*
 * 移植の注意:
 * - 描画の部品（com.jaamsim.render の DisplayModelBinding・VisibilityInfo）は移さない。
 *   描画: 省略（three.js の画面を作るときに）。
 *   getBinding は描画の部品を作る関数なので、子のクラスでは null を返す（戻り値の型は object | null）。
 *   VisibilityInfo は、中身（見える View・距離の範囲）だけを持つ下の VisibilityInfo 型にした。
 * - DisplayEntity・View は、読み込みの輪を避けるため実行時には LateClasses から引く。
 */

/**
 * render.VisibilityInfo の中身（描画: three.js の画面を作るときに、これから本物を作る）。
 * views が null か空なら、すべての View で見える。
 */
export interface VisibilityInfo {
	views: View[] | null;
	minDist: number;
	maxDist: number;
}

const DISPLAY_ENTITY = "com.jaamsim.Graphics.DisplayEntity";

const defRange = DoubleVector.ofValues(0, Double.POSITIVE_INFINITY);

export abstract class DisplayModel extends Entity {
	static readonly ALWAYS: VisibilityInfo = { views: null, minDist: Double.NEGATIVE_INFINITY, maxDist: Double.POSITIVE_INFINITY };
	static readonly ONES = new Vec3d(1.0, 1.0, 1.0);

	private visInfo: VisibilityInfo = DisplayModel.ALWAYS;

	private readonly visibleViews: EntityListInput<View>;

	private readonly drawRange: ValueListInput;

	private readonly modelScale: Vec3dInput;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.active.setDefaultValue(false);

		this.attributeDefinitionList.setHidden(true);
		this.namedExpressionInput.setHidden(true);

		this.visibleViews = new EntityListInput<View>(LateClasses.get<View>("com.jaamsim.Graphics.View"),
				"VisibleViews", Entity.GRAPHICS, null);
		this.setKeywordDoc(this.visibleViews, "The view windows on which this model will be visible. "
		                     + "If this is empty the entity is visible on all views.", []);
		this.visibleViews.setDefaultText("All Views");
		this.visibleViews.setCallback(DisplayModel.updateRangeVisibilityCallback);
		this.addInput(this.visibleViews);

		this.drawRange = new ValueListInput("DrawRange", Entity.GRAPHICS, defRange);
		this.setKeywordDoc(this.drawRange, "The distances from the camera that this display model will be visible",
				["0 100 m"]);
		this.drawRange.setUnitType(DistanceUnit);
		this.drawRange.setValidCount(2);
		this.drawRange.setValidRange(0, Double.POSITIVE_INFINITY);
		this.drawRange.setCallback(DisplayModel.updateRangeVisibilityCallback);
		this.addInput(this.drawRange);

		this.modelScale = new Vec3dInput( "ModelScale", Entity.GRAPHICS, new Vec3d(1, 1, 1));
		this.setKeywordDoc(this.modelScale, "ModelScale scales the resulting visualization by this vector. "
		                     + "Warning!! Resizing an entity with this set to a value that is not 1 "
		                     + "is very unintuitive.",
				["5 5 5"]);
		this.modelScale.setValidRange( 0.0001, 10000);
		this.addInput( this.modelScale);
	}

	/** 描画: 省略（three.js の画面を作るときに）。Java は DisplayModelBinding を返す */
	abstract getBinding(ent: Entity): object | null;

	abstract canDisplayEntity(ent: Entity): boolean;

	static readonly updateRangeVisibilityCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as DisplayModel).updateRangeVisibility();
		},
	} as InputCallback;

	updateRangeVisibility(): void {
		let minDist = this.drawRange.getValue().get(0);
		const maxDist = this.drawRange.getValue().get(1);
		// It's possible for the distance to be behind the camera, yet have the object visible (distance is to center)
		// So instead use negative infinity in place of zero to never cull when close to the camera.
		if (minDist === 0.0) {
			minDist = Double.NEGATIVE_INFINITY;
		}
		this.visInfo = { views: this.visibleViews.getValue(), minDist, maxDist };
	}

	getVisibilityInfo(): VisibilityInfo {

		return this.visInfo;
	}

	getModelScale(): Vec3d {
		return this.modelScale.getValue();
	}

	/** Java の getUserList() と、出力の getUserList(double simTime)（同じ結果） */
	getUserList(_simTime?: number): DisplayEntity[] {
		const ret: DisplayEntity[] = [];
		const cls = LateClasses.get<DisplayEntity>(DISPLAY_ENTITY);
		for (const ent of this.getJaamSimModel().getClonesOfIterator(cls)) {
			if (ent.getDisplayModelList().includes(this)) {
				ret.push(ent);
			}
		}
		return ret;
	}
}

defineOutput(DisplayModel, {
	name: "UserList",
	description: "List of entities that use this DisplayModel for their graphical displays.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getUserList(simTime),
});

LateClasses.bind("com.jaamsim.DisplayModels.DisplayModel", DisplayModel);
