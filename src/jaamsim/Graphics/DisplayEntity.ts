//@@HEADER@@
import { BooleanProvInput } from "../BooleanProviders/BooleanProvInput.ts";
import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import type { CompoundEntity } from "../SubModels/CompoundEntity.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ErrorException } from "../basicsim/ErrorException.ts";
import type { ObjectType } from "../basicsim/ObjectType.ts";
import type { ObserverEntity } from "../basicsim/ObserverEntity.ts";
import { DoubleVector } from "../datatypes/DoubleVector.ts";
import { tr } from "../i18n/I18n.ts";
import { EntityListInput } from "../input/EntityListInput.ts";
import { EnumInput } from "../input/EnumInput.ts";
import type { Input } from "../input/Input.ts";
import { InputAgent } from "../input/InputAgent.ts";
import type { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { RegionInput } from "../input/RegionInput.ts";
import { RelativeEntityInput } from "../input/RelativeEntityInput.ts";
import { ValueListInput } from "../input/ValueListInput.ts";
import { Vec3dInput } from "../input/Vec3dInput.ts";
import { Vec3dListInput } from "../input/Vec3dListInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, Integer, jformat, type JClass } from "../java/lang.ts";
import type { Color4d } from "../math/Color4d.ts";
import { Mat4d } from "../math/Mat4d.ts";
import { Quaternion } from "../math/Quaternion.ts";
import { Transform } from "../math/Transform.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { AngleUnit } from "../units/AngleUnit.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import type { DisplayModel, VisibilityInfo } from "../DisplayModels/DisplayModel.ts";
import { DirectedEntity } from "./DirectedEntity.ts";
import { KeyEvent } from "./Editable.ts";
import type { EntityLabel } from "./EntityLabel.ts";
import { LateClasses, jListEquals } from "./LateClasses.ts";
import { PolylineInfo, PolylineInfo_CurveType } from "./PolylineInfo.ts";
import type { Region } from "./Region.ts";
import { Tag } from "./Tag.ts";
import type { View } from "./View.ts";

/*
 * 移植の注意:
 * - 子のクラス（Region・OverlayEntity・EntityLabel）や DisplayModel の類は、実行時には LateClasses から
 *   名前で引く（import は型だけ）。読み込みの輪で「まだ無いクラスを extends する」誤りを避けるため。
 * - 多重定義は 1 つの関数で見分ける:
 *     getShow() / getShow(simTime)、getShowInput() / getShowInput(simTime)      … 引数を省くと 0.0
 *     getRelativeEntity() / getRelativeEntity(simTime)                           … 引数の有無（子が () だけを上書きする）
 *     getGlobalPosition() / (Vec3d) / (ArrayList<Vec3d>)、getLocalPosition(Vec3d) / (ArrayList<Vec3d>)
 *     getSourcePoint() / (boolean)、getSinkPoint() / (boolean)                    … 引数を省くと true
 *     setRelativeOrientation(Vec3d) / (Quaternion)                                … instanceof で見分ける
 *     getObserverList() / (double)                                               … どちらも同じ結果
 *     getNextList(boolean) / (double)、getPreviousList(boolean) / (double)        … 数なら (double) の方
 * - getDisplayModel(Class) は、クラスか、FillEntity などの interface の値（isInstance を持つ）を受ける。
 * - DragAndDropable（com.jaamsim.ui）の implements は消した（関数は残した）。
 * - 描画の部品（DisplayModelBinding・VisibilityInfo・RenderUtils）は移していない。
 *   modelBindings は DisplayModel.getBinding の戻り値（今は null）を並べるだけ。
 *   visInfo は VisibilityInfo の中身（見える View と距離の範囲）を持つ簡単な値にした。
 */

const defPoints: Vec3d[] = [];
const defRange = new DoubleVector(0.0, Double.POSITIVE_INFINITY);
defPoints.push(new Vec3d(0.0, 0.0, 0.0));
defPoints.push(new Vec3d(1.0, 0.0, 0.0));

/** RenderUtils.getInverseWithScale の写し（行列の計算だけなので、ここに置いた） */
function getInverseWithScale(trans: Transform, scale: Vec3d): Mat4d {
	const t = new Transform(trans);
	t.inverse(t);

	const ret = new Mat4d();
	t.getMat4d(ret);
	const s = new Vec3d(scale);
	// Prevent dividing by zero
	if (s.x === 0) { s.x = 1; }
	if (s.y === 0) { s.y = 1; }
	if (s.z === 0) { s.z = 1; }
	ret.scaleRows3(new Vec3d(1/s.x, 1/s.y, 1/s.z));

	return ret;
}

const REGION = "com.jaamsim.Graphics.Region";
const OVERLAY_ENTITY = "com.jaamsim.Graphics.OverlayEntity";
const ENTITY_LABEL = "com.jaamsim.Graphics.EntityLabel";
const VIEW = "com.jaamsim.Graphics.View";
const COMPOUND_ENTITY = "com.jaamsim.SubModels.CompoundEntity";
const DISPLAY_MODEL = "com.jaamsim.DisplayModels.DisplayModel";
const COLLADA_MODEL = "com.jaamsim.DisplayModels.ColladaModel";
const SHAPE_MODEL = "com.jaamsim.DisplayModels.ShapeModel";
const IMAGE_MODEL = "com.jaamsim.DisplayModels.ImageModel";
const ICON_MODEL = "com.jaamsim.DisplayModels.IconModel";
const TEXT_MODEL = "com.jaamsim.DisplayModels.TextModel";
const POLYLINE_MODEL = "com.jaamsim.DisplayModels.PolylineModel";

/**
 * Encapsulates the methods and data needed to display a simulation object in the 3D environment.
 * Extends the basic functionality of entity in order to have access to the basic system
 * components like the eventManager.
 */
export class DisplayEntity extends Entity {

	protected readonly positionInput: Vec3dInput;

	protected readonly alignmentInput: Vec3dInput;

	protected readonly sizeInput: Vec3dInput;

	protected readonly orientationInput: Vec3dInput;

	protected readonly pointsInput: Vec3dListInput;

	protected readonly curveTypeInput: EnumInput<PolylineInfo_CurveType>;

	protected readonly regionInput: RegionInput;

	protected readonly relativeEntity: RelativeEntityInput;

	protected readonly displayModelListInput: EntityListInput<DisplayModel>;

	private readonly showInput: BooleanProvInput;

	private readonly movable: BooleanProvInput;

	protected readonly visibleViews: EntityListInput<View>;

	protected readonly drawRange: ValueListInput;

	private readonly namedChildren = new Map<string, Entity>();

	private readonly position = new Vec3d();
	private readonly points: Vec3d[] = [];
	private readonly size = new Vec3d(1.0, 1.0, 1.0);
	private readonly orient = new Vec3d();
	private readonly align = new Vec3d();
	private readonly displayModelList: DisplayModel[] = [];
	private show = false;

	private currentRegion: Region | null = null;

	private modelBindings: (object | null)[] | null = null;
	private visInfo: VisibilityInfo | null = null;

	private readonly tagMap = new Map<string, Tag>();

	static readonly LIBRARY_NAME = "User-Defined Objects";

	private cachedPointInfo: PolylineInfo[] | null = null;
	private cachedCurvePoints: Vec3d[] | null = null;

	/**
	 * Constructor: initializing the DisplayEntity's graphics
	 */
	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.positionInput = new Vec3dInput("Position", Entity.GRAPHICS, new Vec3d());
		this.setKeywordDoc(this.positionInput, "The location of the object in {x, y, z} coordinates.",
				["-3.922 -1.830 0.000 m"]);
		this.positionInput.setUnitType(DistanceUnit);
		this.positionInput.setCallback(DisplayEntity.positionCallback);
		this.positionInput.setOutput(false);
		this.addInput(this.positionInput);

		this.alignmentInput = new Vec3dInput("Alignment", Entity.GRAPHICS, new Vec3d());
		this.setKeywordDoc(this.alignmentInput, "The point within the object that is located at the coordinates of "
		                     + "its Position input. Expressed with respect to a unit box centered "
		                     + "about { 0 0 0 }.",
				["-0.5 -0.5 0.0"]);
		this.alignmentInput.setCallback(DisplayEntity.alignmentCallback);
		this.alignmentInput.setOutput(false);
		this.addInput(this.alignmentInput);

		this.sizeInput = new Vec3dInput("Size", Entity.GRAPHICS, new Vec3d(1.0, 1.0, 1.0));
		this.setKeywordDoc(this.sizeInput, "The size of the object in {x, y, z} coordinates.",
				["15 12 0 m"]);
		this.sizeInput.setUnitType(DistanceUnit);
		this.sizeInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.sizeInput.setCallback(DisplayEntity.sizeCallback);
		this.sizeInput.setOutput(false);
		this.addInput(this.sizeInput);

		this.orientationInput = new Vec3dInput("Orientation", Entity.GRAPHICS, new Vec3d());
		this.setKeywordDoc(this.orientationInput, "Euler angles defining the rotation of the object.",
				["0 0 90 deg"]);
		this.orientationInput.setUnitType(AngleUnit);
		this.orientationInput.setCallback(DisplayEntity.orientationCallback);
		this.orientationInput.setOutput(false);
		this.addInput(this.orientationInput);

		this.pointsInput = new Vec3dListInput("Points", Entity.GRAPHICS, defPoints);
		this.setKeywordDoc(this.pointsInput, "A list of points in {x, y, z} coordinates that defines a polyline.",
				["{ 1.0 1.0 0.0 m } { 2.0 2.0 0.0 m } { 3.0 3.0 0.0 m }",
				 "{ 1.0 1.0 m } { 2.0 2.0 m } { 3.0 3.0 m }"]);
		this.pointsInput.setValidCountRange( 2, Integer.MAX_VALUE );
		this.pointsInput.setUnitType(DistanceUnit);
		this.pointsInput.setCallback(DisplayEntity.pointsCallback);
		this.addInput(this.pointsInput);

		this.curveTypeInput = new EnumInput<PolylineInfo_CurveType>(PolylineInfo_CurveType, "CurveType", Entity.GRAPHICS,
				PolylineInfo_CurveType.LINEAR);
		this.setKeywordDoc(this.curveTypeInput, "The type of curve interpolation used for line type entities.", []);
		this.curveTypeInput.setCallback(DisplayEntity.curveTypeCallback);
		this.addInput(this.curveTypeInput);

		this.regionInput = new RegionInput("Region", Entity.GRAPHICS, null);
		this.setKeywordDoc(this.regionInput, "If a Region is specified, the Position and Orientation inputs for "
		                     + "the present object are relative to the Position and Orientation "
		                     + "of the specified Region. If the specified Region is moved or "
		                     + "rotated, the present object is moved to maintain its relative "
		                     + "position and orientation.",
				["Region1"]);
		this.regionInput.setCallback(DisplayEntity.regionCallback);
		this.regionInput.setOutput(false);
		this.addInput(this.regionInput);

		this.relativeEntity = new RelativeEntityInput("RelativeEntity", Entity.GRAPHICS, null);
		this.setKeywordDoc(this.relativeEntity, "If an object is specified, the Position input for the present object "
		                     + "is relative to the Position for the specified object. If the "
		                     + "specified object is moved, the present object is moved to maintain "
		                     + "its relative position.",
				["DisplayEntity1"]);
		this.addInput(this.relativeEntity);

		this.displayModelListInput = new EntityListInput<DisplayModel>(
				LateClasses.get<DisplayModel>(DISPLAY_MODEL), "DisplayModel", Entity.GRAPHICS, null);
		this.setKeywordDoc(this.displayModelListInput, "The graphic representation of the object. If a list of DisplayModels "
		                     + "is entered, each one is displayed provided that its DrawRange "
		                     + "input is satisfied. This feature allows the object's appearance to "
		                     + "change with its distance from the View window's camera.", []);
		this.displayModelListInput.addValidClass(LateClasses.get(COLLADA_MODEL));
		this.displayModelListInput.addValidClass(LateClasses.get(SHAPE_MODEL));
		this.displayModelListInput.addValidClass(LateClasses.get(IMAGE_MODEL));
		this.displayModelListInput.addInvalidClass(LateClasses.get(ICON_MODEL));
		this.displayModelListInput.setCallback(DisplayEntity.displayModelListCallback);
		this.addInput(this.displayModelListInput);
		this.displayModelListInput.setUnique(false);

		this.showInput = new BooleanProvInput("Show", Entity.GRAPHICS, true);
		this.setKeywordDoc(this.showInput, "If TRUE, the object is displayed in the View windows.", []);
		this.showInput.setCallback(DisplayEntity.showCallback);
		this.showInput.setOutput(false);
		this.addInput(this.showInput);

		this.movable = new BooleanProvInput("Movable", Entity.GRAPHICS, true);
		this.setKeywordDoc(this.movable, "If TRUE, the object will respond to mouse clicks and can be "
		                     + "positioned by dragging with the mouse.", []);
		this.addInput(this.movable);

		this.visibleViews = new EntityListInput<View>(LateClasses.get<View>(VIEW), "VisibleViews", Entity.GRAPHICS, null);
		this.setKeywordDoc(this.visibleViews, "The view windows on which this entity will be visible.", []);
		this.visibleViews.setDefaultText("All Views");
		this.visibleViews.setCallback(DisplayEntity.updateRangeVisibilityCallback);
		this.addInput(this.visibleViews);

		this.drawRange = new ValueListInput("DrawRange", Entity.GRAPHICS, defRange);
		this.setKeywordDoc(this.drawRange, "The minimum and maximum distance from the camera for which this "
		                     + "entity is displayed.",
				["0 100 m"]);
		this.drawRange.setUnitType(DistanceUnit);
		this.drawRange.setValidCount(2);
		this.drawRange.setValidRange(0, Double.POSITIVE_INFINITY);
		this.drawRange.setCallback(DisplayEntity.updateRangeVisibilityCallback);
		this.addInput(this.drawRange);

		// ---- Java のコンストラクタの中身 ----
		const type: ObjectType | null = this.getObjectType();
		if (type === null || type === undefined)
			return;

		// Set the default DisplayModel
		this.displayModelListInput.setDefaultValue(type.getDefaultDisplayModel());
		this.setDisplayModelList(type.getDefaultDisplayModel());

		// Set the default size
		this.sizeInput.setDefaultValue(type.getDefaultSize());
		this.setSize(type.getDefaultSize());

		// Set the default Alignment
		this.alignmentInput.setDefaultValue(type.getDefaultAlignment());
		this.setAlignment(type.getDefaultAlignment());

		this.setShow(this.getShowInput());

		// Choose which set of keywords to show
		this.setGraphicsKeywords();
	}

	override setInputsForDragAndDrop(): void {

		// Determine whether the entity should sit on top of the x-y plane
		let alignBottom = true;
		const displayModels = this.displayModelListInput.getValue();
		if (displayModels !== null && displayModels.length > 0) {
			const dm0 = displayModels[0];
			if (LateClasses.isInstance(dm0, SHAPE_MODEL) || LateClasses.isInstance(dm0, IMAGE_MODEL)
					|| LateClasses.isInstance(dm0, TEXT_MODEL))
				alignBottom = false;
		}

		if (this.usePointsInput() || this.alignmentInput.getHidden() || this.getSize().z === 0.0) {
			alignBottom = false;
		}

		if (alignBottom)
			InputAgent.applyArgs(this, "Alignment", "0.0", "0.0", "-0.5");
	}

	static readonly positionCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const de = ent as DisplayEntity;
			const v3dinp = inp as unknown as Vec3dInput;

			if (de.usePointsInput())
				return;
			de.setPosition(v3dinp.getValue());
		},
	} as InputCallback;

	static readonly pointsCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const de = ent as DisplayEntity;
			const v3dinp = inp as unknown as Vec3dListInput;

			if (!de.usePointsInput())
				return;
			de.updateForPointsInput(v3dinp.getValue());
		},
	} as InputCallback;

	static readonly sizeCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const de = ent as DisplayEntity;
			const v3dinp = inp as unknown as Vec3dInput;

			de.setSize(v3dinp.getValue());
		},
	} as InputCallback;

	static readonly orientationCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const de = ent as DisplayEntity;
			const v3dinp = inp as unknown as Vec3dInput;

			de.setOrientation(v3dinp.getValue());
		},
	} as InputCallback;

	static readonly alignmentCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const de = ent as DisplayEntity;
			const v3dinp = inp as unknown as Vec3dInput;

			de.setAlignment(v3dinp.getValue());
		},
	} as InputCallback;

	static readonly showCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const de = ent as DisplayEntity;
			de.setShow(de.getShowInput());
		},
	} as InputCallback;

	static readonly curveTypeCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as DisplayEntity).invalidateScreenPoints();
		},
	} as InputCallback;

	static readonly displayModelListCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as DisplayEntity).displayModelCallback();
		},
	} as InputCallback;

	displayModelCallback(): void {
		const bool = this.usePointsInput();
		this.setDisplayModelList(this.displayModelListInput.getValue());
		this.setGraphicsKeywords();

		// Refresh the contents of the Input Editor
		const gui = this.getJaamSimModel().getGUIListener();
		if (gui !== null && gui !== undefined && this.usePointsInput() !== bool)
			gui.updateInputEditor(this);
	}

	static readonly regionCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			const de = ent as DisplayEntity;
			const region = inp.getValue() as Region | null;
			de.setRegion(region);
		},
	} as InputCallback;

	static readonly updateRangeVisibilityCallback: InputCallback = {
		callback(ent: Entity, inp: Input<unknown>): void {
			(ent as DisplayEntity).updateRangeVisibility();
		},
	} as InputCallback;

	updateRangeVisibility(): void {
		if (this.visibleViews.isDefault() && this.drawRange.isDefault()) {
			this.visInfo = null;
		}
		let minDist = this.drawRange.getValue().get(0);
		const maxDist = this.drawRange.getValue().get(1);
		// It's possible for the distance to be behind the camera, yet have the object visible (distance is to center)
		// So instead use negative infinity in place of zero to never cull when close to the camera.
		if (minDist === 0.0) {
			minDist = Double.NEGATIVE_INFINITY;
		}
		// 描画: VisibilityInfo の代わりに、中身だけを持つ（three.js の画面を作るときに）
		this.visInfo = { views: this.visibleViews.getValue(), minDist, maxDist };
	}

	override postDefine(): void {
		super.postDefine();

		// Add a label if required
		if (this.getSimulation() !== null && this.getSimulation().isShowLabels()
				&& this.canLabel()) {
			const EntityLabelClass = LateClasses.get(ENTITY_LABEL) as unknown as typeof EntityLabel;
			EntityLabelClass.showTemporaryLabel(this);
		}
	}

	override validate(): void {
		super.validate();

		if (this.getDisplayModelList() !== null) {
			for (const dm of this.getDisplayModelList()) {
				if (!dm.canDisplayEntity(this)) {
					throw new InputErrorException(jformat(tr("Invalid DisplayModel: %s for this object"),
							dm.getName()));
				}
			}
		}
	}

	override earlyInit(): void {
		super.earlyInit();

		// Required for a pooled clone that was modified by a 'SetGraphics' object
		this.resetGraphics();
	}

	override kill(): void {
		super.kill();
		if (this.isDragAndDrop()) {
			const gui = this.getJaamSimModel().getGUIListener();
			if (gui !== null && gui !== undefined) {
				gui.updateModelBuilder();
			}
		}
	}

	override restore(): void {
		super.restore();
		if (this.isDragAndDrop()) {
			const gui = this.getJaamSimModel().getGUIListener();
			if (gui !== null && gui !== undefined) {
				gui.updateModelBuilder();
			}
		}
	}

	updateForPointsInput(pts: Vec3d[]): void {
		this.setPoints(pts);

		// Set the position to the point half way between the first and last nodes
		const pos = new Vec3d(pts[0]);
		pos.add3(pts[pts.length - 1]);
		pos.scale3(0.5, pos);
		this.setPosition(pos);
	}

	override getChild(name: string): Entity | null {
		return this.namedChildren.get(name) ?? null;
	}

	override addChild(ent: Entity): void {
		// If the entity is dead, it already has a hashmap of its children
		if (this.isDead())
			return;

		if (this.namedChildren.get(ent.getLocalName()) !== undefined)
			throw new ErrorException("Entity name: %s is already in use.", ent.getName());
		this.namedChildren.set(ent.getLocalName(), ent);
	}

	override removeChild(ent: Entity): void {
		// If the entity is dead, then retain its hashmap of children
		if (this.isDead())
			return;

		const prev = this.namedChildren.get(ent.getLocalName()) ?? null;
		this.namedChildren.delete(ent.getLocalName());
		if (ent !== prev)
			throw new ErrorException("Named Children Internal Consistency error: %s", ent);
	}

	/** Java の getChildren()（出力の getChildren(simTime) も同じ結果） */
	override getChildren(_simTime?: number): Entity[] {
		return [...this.namedChildren.values()];
	}

	/**
	 * Returns whether the object is eligible for automatic labeling, when activated.
	 * @return true if eligible for labeling
	 */
	canLabel(): boolean {
		return this.isRegistered() && this.getName() !== "XY-Grid" && this.getName() !== "XYZ-Axis";
	}

	/**
	 * Restores the initial appearance of this entity.
	 */
	resetGraphics(): void {

		// Normal objects
		if (!this.usePointsInput()) {
			this.setPosition(this.positionInput.getValue());
			this.pointsInput.reset();
		}

		// Polyline objects
		else {
			this.updateForPointsInput(this.pointsInput.getValue());
			this.positionInput.reset();
		}

		this.setSize(this.sizeInput.getValue());
		this.setAlignment(this.alignmentInput.getValue());
		this.setOrientation(this.orientationInput.getValue());
		this.setDisplayModelList(this.displayModelListInput.getValue());
		this.setRegion(this.regionInput.getValue());
		this.setShow(this.getShowInput());
	}

	isPositionNominal(): boolean {
		return this.position.equals3(this.positionInput.getValue());
	}

	isPointsNominal(): boolean {
		return jListEquals(this.points, this.pointsInput.getValue());
	}

	isSizeNominal(): boolean {
		return this.size.equals3(this.sizeInput.getValue());
	}

	isAlignmentNominal(): boolean {
		return this.align.equals3(this.alignmentInput.getValue());
	}

	isOrientationNominal(): boolean {
		return this.orient.equals3(this.orientationInput.getValue());
	}

	isDisplayModelNominal(): boolean {
		return this.displayModelList.length === 0 && this.displayModelListInput.getValue() === null
				|| jListEquals(this.displayModelList, this.displayModelListInput.getValue());
	}

	isRegionNominal(): boolean {
		return this.getCurrentRegion() === this.regionInput.getValue();
	}

	isShowNominal(): boolean {
		return this.show === this.getShowInput();
	}

	isGraphicsNominal(): boolean {
		return this.isPositionNominal() && this.isPointsNominal() && this.isSizeNominal() && this.isAlignmentNominal()
				&& this.isOrientationNominal() && this.isDisplayModelNominal() && this.isRegionNominal()
				&& this.isShowNominal();
	}

	private showStandardGraphicsKeywords(bool: boolean): void {
		this.positionInput.setHidden(!bool);
		this.sizeInput.setHidden(!bool);
		this.alignmentInput.setHidden(!bool);
		this.orientationInput.setHidden(!bool);
	}

	private showPolylineGraphicsKeywords(bool: boolean): void {
		this.pointsInput.setHidden(!bool);
		this.curveTypeInput.setHidden(!bool);
	}

	usePointsInput(): boolean {
		const dmList = this.displayModelListInput.getValue();
		if (dmList === null || dmList.length === 0)
			return false;
		return LateClasses.isInstance(dmList[0], POLYLINE_MODEL);
	}

	private setGraphicsKeywords(): void {

		// No displaymodel
		if (LateClasses.isInstance(this, OVERLAY_ENTITY) || this.displayModelListInput.getValue() === null) {
			this.showStandardGraphicsKeywords(false);
			this.showPolylineGraphicsKeywords(false);
			this.regionInput.setHidden(true);
			this.relativeEntity.setHidden(true);
			this.showInput.setHidden(true);
			return;
		}

		// Polyline type displaymodel
		if (this.usePointsInput()) {
			this.showStandardGraphicsKeywords(false);
			this.showPolylineGraphicsKeywords(true);
			return;
		}

		// Standard displaymodel
		this.showStandardGraphicsKeywords(true);
		this.showPolylineGraphicsKeywords(false);
	}

	getCurrentRegion(): Region | null {
		if (this.currentRegion === null && this.getParent() instanceof DisplayEntity)
			return (this.getParent() as DisplayEntity).getCurrentRegion();
		return this.currentRegion;
	}

	setRegion(newRegion: Region | null): void {
		this.currentRegion = newRegion;
	}

	getPosition(): Vec3d {
		return new Vec3d(this.position);
	}

	setPosition(pos: Vec3d): void {
		this.position.set3(pos);
	}

	getSize(): Vec3d {
		return new Vec3d(this.size);
	}

	setSize(size: Vec3d): void {
		this.size.set3(size);
	}

	getOrientation(): Vec3d {
		return new Vec3d(this.orient);
	}

	setOrientation(orientation: Vec3d): void {
		this.orient.set3(orientation);
	}

	getAlignment(): Vec3d {
		return new Vec3d(this.align);
	}

	setAlignment(align: Vec3d): void {
		this.align.set3(align);
	}

	/**
	 * Java の getShow()（final、getShow(0.0) を呼ぶ）と getShow(double simTime)。
	 * 子のクラスは getShow(simTime) を上書きする。
	 */
	getShow(simTime: number = 0.0): boolean {
		if (this.isPooled())
			return false;
		let ret: boolean;
		if (!this.showInput.isConstant()) {
			ret = this.getShowInput(simTime);
		}
		else {
			ret = this.show;
		}

		if (LateClasses.isInstance(this.getParent(), COMPOUND_ENTITY)) {
			const sub = this.getParent() as unknown as CompoundEntity;
			const region = sub.getSubModelRegion();
			if ((this as DisplayEntity) === (region as unknown as DisplayEntity) || this.getCurrentRegion() === region) {
				ret = ret && (sub.isShowComponents(simTime) || this.getSimulation().isShowSubModels());
			}
		}
		return ret;
	}

	/** Java の getShowInput()（final、getShowInput(0.0) を呼ぶ）と getShowInput(double simTime) */
	getShowInput(simTime: number = 0.0): boolean {
		return this.showInput.getNextBoolean(this, simTime);
	}

	setShow(bool: boolean): void {
		this.show = bool;
	}

	isMovable(): boolean {
		return this.movable.getNextBoolean(this, 0.0);
	}

	/**
	 * Java の getRelativeEntity() と getRelativeEntity(double simTime)。
	 * 引数の無い呼び出しは getRelativeEntity(0.0) と同じ（子のクラスは引数の無い方だけを上書きすることがある）。
	 */
	getRelativeEntity(simTime?: number): DisplayEntity | null {
		if (simTime === undefined)
			return this.getRelativeEntity(0.0);
		return this.relativeEntity.getNextEntity(this, simTime);
	}

	getRelativeEntityOptions(): string[] {
		return this.relativeEntity.getValidOptions(this);
	}

	getRegionOptions(): string[] {
		return this.regionInput.getValidOptions(this);
	}

	getVisibleViews(): View[] | null {
		return this.visibleViews.getValue();
	}

	getParentOptions(): string[] {
		return this.parentInput.getValidOptions(this);
	}

	/**
	 * Sets the orientation to the specified value relative its its normal orientation.
	 * Java の setRelativeOrientation(Vec3d relOrient)（オイラー角）と setRelativeOrientation(Quaternion rotQ)。
	 * @param relOrient - Euler angles for relative orientation
	 */
	setRelativeOrientation(arg: Vec3d | Quaternion): void {
		if (arg instanceof Quaternion) {
			const rotQ = arg;
			const q = new Quaternion();
			q.setEuler3(this.orientationInput.getValue());
			q.mult(rotQ, q);
			this.setOrientation(q.getEuler3());
			return;
		}
		const relOrient = arg;
		const rotQ = new Quaternion();
		rotQ.setEuler3(relOrient);
		this.setRelativeOrientation(rotQ);
	}

	/**
	 * Returns the entity's size in the global coordinate system after applying its orientation.
	 * @return global size
	 */
	getGlobalSize(): Vec3d {
		const ret = this.getSize();
		const xdir = new Vec3d(ret.x, 0.0, 0.0);
		const ydir = new Vec3d(0.0, ret.y, 0.0);
		const zdir = new Vec3d(0.0, 0.0, ret.z);

		const mat = new Mat4d();
		mat.setEuler3(this.orientationInput.getValue());
		xdir.mult3(mat, xdir);
		ydir.mult3(mat, ydir);
		zdir.mult3(mat, zdir);

		ret.x = Math.abs(xdir.x) + Math.abs(ydir.x) + Math.abs(zdir.x);
		ret.y = Math.abs(xdir.y) + Math.abs(ydir.y) + Math.abs(zdir.y);
		ret.z = Math.abs(xdir.z) + Math.abs(ydir.z) + Math.abs(zdir.z);
		return ret;
	}

	/**
	 * Update any internal stated needed by either renderer.
	 */
	updateGraphics(simTime: number): void {
	}

	private calculateEulerRotation(val: Vec3d, euler: Vec3d): void {
		const mat = new Mat4d();
		mat.setEuler3(euler);
		val.mult3(mat, val);
	}

	/**
	 * Returns the local coordinates corresponding to a specified position in the entity's
	 * internal coordinate system relative to its centre.
	 * @param pos - internal position
	 * @return local position
	 */
	getPositionForAlignment(pos: Vec3d): Vec3d {
		const temp = new Vec3d(pos);
		temp.sub3(this.align);
		temp.mul3(this.size);
		this.calculateEulerRotation(temp, this.orient);
		temp.add3(this.position);
		return temp;
	}

	/**
	 * Returns the local coordinates for the centre of the entity.
	 * @return local coordinates for the entity's centre
	 */
	getCentre(): Vec3d {
		return this.getPositionForAlignment(new Vec3d());
	}

	/**
	 * Sets the position of the entity so that its centre is located at the specified position.
	 * @param pos - local coordinates for the entity's centre
	 */
	setCentre(pos: Vec3d): void {
		this.setPositionForAlignment(pos, new Vec3d());
	}

	/**
	 * Sets the position of the entity so that its specified alignment point is located at the
	 * specified position.
	 * @param pos - local coordinates
	 * @param algn - alignment point within the entity
	 */
	setPositionForAlignment(pos: Vec3d, algn: Vec3d): void {
		const newPos = new Vec3d(pos);
		const temp = new Vec3d(algn);
		temp.sub3(this.align);
		temp.mul3(this.size);
		this.calculateEulerRotation(temp, this.orient);
		newPos.sub3(temp);
		this.position.set3(newPos);
	}

	/**
	 * Returns the global coordinates for the given position in the entity's internal coordinate
	 * system, relative to its centre.
	 * @param pos - position in internal coordinates
	 * @return position in global coordinates
	 */
	getGlobalPositionForPosition(pos: Vec3d): Vec3d {
		let temp = new Vec3d(pos);
		const scaledAlign = new Vec3d(this.align);
		scaledAlign.mul3(this.size);
		temp.sub3(scaledAlign);
		this.calculateEulerRotation(temp, this.orient);
		temp.add3(this.getPosition());
		temp = this.getGlobalPosition(temp);
		return temp;
	}

	/**
	 * Returns the transformation that converts a point in the entity's
	 * coordinates to the global coordinate system.
	 * <p>
	 * The entity's coordinate system is centred on the entity's alignment point
	 * and its axes are rotated by the entity's orientation angles. It is NOT
	 * scaled by the entity's size, so the coordinates still have units of
	 * metres. The effects of the RelativeEntity and Region inputs are included
	 * in the transformation.
	 * @return global coordinates for the point.
	 */
	getGlobalTrans(): Transform {
		return this.getGlobalTransForSize(this.size);
	}

	/**
	 * Returns the equivalent global transform for this entity as if 'sizeIn' where the actual
	 * size.
	 * @param sizeIn
	 */
	getGlobalTransForSize(sizeIn: Vec3d): Transform {
		// Okay, this math may be hard to follow, this is effectively merging two TRS transforms,
		// The first is a translation only transform from the alignment parameter
		// Then a transform is built up based on position and orientation
		// As size is a non-uniform scale it can not be represented by the jaamsim TRS Transform and therefore
		// not actually included in this result, except to adjust the alignment

		// Alignment transformations
		const temp = new Vec3d(sizeIn);
		temp.mul3(this.align);
		temp.scale3(-1.0);
		const alignTrans = new Transform(temp);

		// Orientation transformation
		const rot = new Quaternion();
		rot.setEuler3(this.orient);
		const ret = new Transform(null, rot, 1);

		// Combine the alignment and orientation transformations
		ret.merge(ret, alignTrans);

		// Convert the alignment/orientation transformation to the global coordinate system
		const region = this.getCurrentRegion();
		if (region !== null)
			ret.merge(region.getRegionTransForVectors(), ret);

		// Offset the transformation by the entity's global position vector
		ret.getTransRef().add3(this.getGlobalPosition());

		return ret;
	}

	/**
	 * Returns the transformation that converts a point in the global
	 * coordinate system to the entity's coordinates.
	 * <p>
	 * The entity's coordinate system is centred on the entity's alignment point
	 * and its axes are rotated by the entity's orientation angles. It is NOT
	 * scaled by the entity's size, so the coordinates still have units of
	 * metres. The effects of the RelativeEntity and Region inputs are included
	 * in the transformation.
	 * @return local coordinates for the point.
	 */
	getEntityTransForSize(sizeIn: Vec3d): Transform {
		const trans = new Transform();
		this.getGlobalTransForSize(sizeIn).inverse(trans);
		return trans;
	}

	/**
	 * Returns the global transform with scale factor all rolled into a Matrix4d
	 */
	getTransMatrix(scale: Vec3d): Mat4d {
		const trans = this.getGlobalTrans();
		const ret = new Mat4d();
		trans.getMat4d(ret);
		ret.scaleCols3(scale);
		return ret;
	}

	/**
	 * Returns the inverse global transform with scale factor all rolled into a Matrix4d
	 */
	getInvTransMatrix(): Mat4d {
		return getInverseWithScale(this.getGlobalTrans(), this.size);
	}

	/**
	 * Returns the position of the centre in the global coordinate system.
	 * @return global position of the centre
	 */
	getGlobalCentre(): Vec3d {
		return this.getGlobalPosition(this.getCentre());
	}

	/**
	 * Java の 3 つの多重定義:
	 *   getGlobalPosition()                    … Return the position in the global coordinate system
	 *   getGlobalPosition(Vec3d pos)           … Convert the specified local coordinate to the global coordinate system
	 *   getGlobalPosition(ArrayList<Vec3d> pts)… Returns the global coordinates for a specified array of local coordinates.
	 */
	getGlobalPosition(): Vec3d;
	getGlobalPosition(pos: Vec3d): Vec3d;
	getGlobalPosition(pts: Vec3d[]): Vec3d[];
	getGlobalPosition(arg?: Vec3d | Vec3d[]): Vec3d | Vec3d[] {
		if (arg === undefined)
			return this.getGlobalPosition(this.getPosition());

		if (Array.isArray(arg)) {
			const ret: Vec3d[] = [];
			for (const pt of arg) {
				ret.push(this.getGlobalPosition(pt));
			}
			return ret;
		}

		const pos = arg;
		const ret = new Vec3d(pos);

		// Position is relative to another entity
		const ent = this.getRelativeEntity();
		const region = this.getCurrentRegion();
		if (ent !== null) {
			if (region !== null)
				region.getRegionTransForVectors().multAndTrans(ret, ret);
			ret.add3(ent.getGlobalPosition());
			return ret;
		}

		// Position is given in a local coordinate system
		if (region !== null)
			region.getRegionTrans().multAndTrans(ret, ret);

		return ret;
	}

	setGlobalPosition(pos: Vec3d): void {
		this.setPosition(this.getLocalPosition(pos));
	}

	setGlobalPositionForAlignment(pos: Vec3d, algn: Vec3d): void {
		this.setPositionForAlignment(this.getLocalPosition(pos), algn);
	}

	/**
	 * Java の 2 つの多重定義:
	 *   getLocalPosition(Vec3d pos)            … Returns the local coordinates for this entity corresponding to the
	 *                                            specified global coordinates.
	 *   getLocalPosition(ArrayList<Vec3d> pts) … Returns the local coordinates for a specified array of global coordinates.
	 */
	getLocalPosition(pos: Vec3d): Vec3d;
	getLocalPosition(pts: Vec3d[]): Vec3d[];
	getLocalPosition(arg: Vec3d | Vec3d[]): Vec3d | Vec3d[] {
		if (Array.isArray(arg)) {
			const ret: Vec3d[] = [];
			for (const pt of arg) {
				ret.push(this.getLocalPosition(pt));
			}
			return ret;
		}

		const pos = arg;
		const localPos = new Vec3d(pos);
		const region = this.getCurrentRegion();

		// Position is relative to another entity
		const ent = this.getRelativeEntity();
		if (ent !== null) {
			localPos.sub3(ent.getGlobalPosition());
			if (region !== null)
				region.getInverseRegionTransForVectors().multAndTrans(localPos, localPos);
			return localPos;
		}

		// Position is given in a local coordinate system
		if (region !== null)
			region.getInverseRegionTrans().multAndTrans(pos, localPos);

		return localPos;
	}

	/**
	 * Returns the transformation to global coordinates from the local
	 * coordinate system determined by the entity's Region and RelativeEntity
	 * inputs.
	 * <p>
	 * Note that this local coordinate system is centred on the position of
	 * the RelativeEntity, not on the position of this entity.
	 * @return transformation to global coordinates.
	 */
	getGlobalPositionTransform(): Transform {
		let ret = new Transform(null, null, 1.0);
		const region = this.getCurrentRegion();

		// Position is relative to another entity
		const relEnt = this.getRelativeEntity();
		if (relEnt !== null) {
			if (region !== null)
				ret = region.getRegionTransForVectors();
			ret.getTransRef().add3(relEnt.getGlobalPosition());
			return ret;
		}

		// Position is given in a local coordinate system
		if (region !== null)
			ret = region.getRegionTrans();

		return ret;
	}

	/**
	 * Returns the first entry in the 'DisplayModel' input that is an instance of the specified
	 * class (or sub-class) or that implements the specified interface.
	 * Null is returned if no such DisplayModel is found.
	 * 移植: klass はクラスか、interface の値（FillEntity など、isInstance を持つもの）。
	 * @return first DisplayModel that is an instance of the class or implements the interface
	 */
	getDisplayModel<T>(klass: JClass<T> | { isInstance(o: unknown): o is T }): T | null {
		const list = this.displayModelListInput.getValue();
		if (list === null)
			return null;
		for (const model of list) {
			const ok = typeof klass === "function" ? model instanceof klass : klass.isInstance(model);
			if (ok)
				return model as unknown as T;
		}
		return null;
	}

	getDisplayModelList(): DisplayModel[] {
		return this.displayModelList;
	}

	setDisplayModelList(dmList: DisplayModel[] | null): void {
		if (dmList !== null && jListEquals(dmList, this.displayModelList))
			return;
		this.displayModelList.length = 0;
		if (dmList === null)
			return;
		for (const dm of dmList) {
			this.displayModelList.push(dm);
		}
		this.clearBindings(); // Clear this on any change, and build it lazily later
	}

	clearBindings(): void {
		this.modelBindings = null;
	}

	/**
	 * 描画: 省略（three.js の画面を作るときに）。
	 * DisplayModel.getBinding の戻り値（今は null）を並べるだけ。
	 */
	getDisplayBindings(): (object | null)[] {
		if (this.modelBindings === null) {
			// Populate the model binding list
			if (this.getDisplayModelList() === null) {
				this.modelBindings = [];
				return this.modelBindings;
			}
			this.modelBindings = [];
			for (let i = 0; i < this.getDisplayModelList().length; ++i) {
				const dm = this.getDisplayModelList()[i];
				this.modelBindings.push(dm.getBinding(this));
			}
		}
		return this.modelBindings;
	}

	getVisibilityInfo(): VisibilityInfo | null {
		return this.visInfo;
	}

	dragged(x: number, y: number, newPos: Vec3d): void {
		// Normal objects
		if (!this.usePointsInput()) {
			InputAgent.applyVec3d(this, this.positionInput.getKeyword(), newPos, DistanceUnit);
			return;
		}

		// Polyline objects
		const dist = new Vec3d(newPos);
		const pts = this.pointsInput.getValue();
		dist.sub3(pts[0]);
		const kw = KeywordIndex.formatPointsInputs(this, this.pointsInput.getKeyword(), pts, dist);
		InputAgent.apply(this, kw);
	}

	/**
	 * Performs the specified keyboard event.
	 * @param keyCode - newt key code
	 * @param keyChar - alphanumeric character for the key (if applicable)
	 * @param shift - true if the Shift key is held down
	 * @param control - true if the Control key is held down
	 * @param alt - true if the Alt key is held down
	 * @return true if the key event was consumed by this entity
	 */
	handleKeyPressed(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): boolean {
		if (!this.isMovable())
			return false;

		let inc = this.getSimulation().getIncrementSize();
		if (this.getSimulation().isSnapToGrid())
			inc = Math.max(inc, this.getSimulation().getSnapGridSpacing());

		let offset = new Vec3d();
		switch (keyCode) {

			case KeyEvent.VK_LEFT:
				offset.x -= inc;
				break;

			case KeyEvent.VK_RIGHT:
				offset.x += inc;
				break;

			case KeyEvent.VK_UP:
				if (shift)
					offset.z += inc;
				else
					offset.y += inc;
				break;

			case KeyEvent.VK_DOWN:
				if (shift)
					offset.z -= inc;
				else
					offset.y -= inc;
				break;

			default:
				return false;
		}

		// Normal object
		if (!this.usePointsInput()) {
			let pos = this.getPosition();
			pos.add3(offset);
			if (this.getSimulation().isSnapToGrid())
				pos = this.getSimulation().getSnapGridPosition(pos, pos, shift);
			const posKey = this.positionInput.getKeyword();
			const posKw = KeywordIndex.formatVec3dInput(this, posKey, pos, DistanceUnit);
			this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, posKw));
			return true;
		}

		// Polyline object
		if (this.getSimulation().isSnapToGrid()) {
			let pts0 = new Vec3d(this.getPoints()[0]);
			pts0.add3(offset);
			pts0 = this.getSimulation().getSnapGridPosition(pts0, pts0, shift);
			offset = new Vec3d(pts0);
			offset.sub3(this.getPoints()[0]);
		}
		const ptsKey = this.pointsInput.getKeyword();
		const ptsKw = KeywordIndex.formatPointsInputs(this, ptsKey, this.getPoints(), offset);

		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, ptsKw));
		return true;
	}

	handleKeyReleased(keyCode: number, keyChar: string, shift: boolean, control: boolean, alt: boolean): void {
		if (keyCode === KeyEvent.VK_DELETE) {
			const gui = this.getJaamSimModel().getGUIListener();
			if (gui === null || gui === undefined)
				return;
			try {
				gui.deleteEntity(this);
				// 描画: 省略（three.js の画面を作るときに）。FrameBox.setSelectedEntity(null, false)
			}
			catch (e) {
				if (!(e instanceof ErrorException)) throw e;
				gui.invokeErrorDialogBox(tr("User Error"), e.message);
			}
		}
	}

	handleMouseClicked(count: number, globalCoord: Vec3d, shift: boolean, control: boolean, alt: boolean): void {}

	handleDrag(currentPt: Vec3d, firstPt: Vec3d): boolean {
		return false;
	}

	/**
	 * Returns whether this entity can link in the specified direction to another entity.
	 * @param dir - entity flow direction
	 * @return true if a link can be started
	 */
	canLink(dir: boolean): boolean {
		return false;
	}

	/**
	 * An overloadable method that is called when the 'create link' feature is enabled and selection changes
	 * @param nextEnt
	 */
	linkTo(nextEnt: DisplayEntity, dir: boolean): void {}

	/**
	 * Set the inputs for the two entities affected by a 'split' operation.
	 * @param splitEnt - entity split from the original
	 */
	setInputsForSplit(splitEnt: DisplayEntity): void {
		// Do nothing in default behavior
	}

	protected invalidateScreenPoints(): void {
		this.cachedPointInfo = null;
		this.cachedCurvePoints = null;
	}

	getScreenPoints(simTime: number): PolylineInfo[] {
		if (this.cachedPointInfo === null)
			this.cachedPointInfo = this.buildScreenPoints(simTime);
		return this.cachedPointInfo;
	}

	buildScreenPoints(simTime: number): PolylineInfo[] {
		const ret: PolylineInfo[] = [];
		ret[0] = new PolylineInfo(this.getCurvePoints(), null, -1, -1.0);
		return ret;
	}

	getPoints(): Vec3d[] {
		return [...this.points];
	}

	getCurvePoints(): Vec3d[] {
		if (this.cachedCurvePoints === null)
			this.cachedCurvePoints = this.buildCurvePoints();
		return this.cachedCurvePoints;
	}

	private buildCurvePoints(): Vec3d[] {
		let ret: Vec3d[] | null = null;
		switch (this.getCurveType()) {
		case PolylineInfo_CurveType.LINEAR:
			ret = this.getPoints();
			break;
		case PolylineInfo_CurveType.BEZIER:
			ret = PolylineInfo.getBezierPoints(this.getPoints());
			break;
		case PolylineInfo_CurveType.SPLINE:
			ret = PolylineInfo.getSplinePoints(this.getPoints());
			break;
		case PolylineInfo_CurveType.CIRCULAR_ARC:
			ret = PolylineInfo.getCircularArcPoints(this.getPoints());
			break;
		default:
			this.error(tr("Invalid CurveType"));
		}
		return ret as Vec3d[];
	}

	setPoints(pts: Vec3d[]): void {
		this.points.length = 0;
		this.points.push(...pts);
		this.invalidateScreenPoints();
	}

	setGlobalPoints(pts: Vec3d[]): void {
		this.points.length = 0;
		this.points.push(...this.getLocalPosition(pts));
		this.invalidateScreenPoints();
	}

	selectable(): boolean {
		return true;
	}

	protected getCurveType(): PolylineInfo_CurveType {
		return this.curveTypeInput.getValue();
	}

	setTagColour(tagName: string, ca: Color4d): void {
		const cas: Color4d[] = [ca];
		this.setTagColours(tagName, cas);
	}

	setTagColours(tagName: string, cas: Color4d[]): void {
		let t = this.tagMap.get(tagName);
		if (t === undefined) {
			t = new Tag(cas, null, true);
			this.tagMap.set(tagName, t);
			return;
		}

		if (t.colorsMatch(cas))
			return;
		else
			this.tagMap.set(tagName, new Tag(cas, t.sizes, t.visible));
	}

	setTagSize(tagName: string, size: number): void {
		const s: number[] = [size];
		this.setTagSizes(tagName, s);
	}

	setTagSizes(tagName: string, sizes: number[]): void {
		let t = this.tagMap.get(tagName);
		if (t === undefined) {
			t = new Tag(null, sizes, true);
			this.tagMap.set(tagName, t);
			return;
		}

		if (t.sizesMatch(sizes))
			return;
		else
			this.tagMap.set(tagName, new Tag(t.colors, sizes, t.visible));
	}

	setTagVisibility(tagName: string, isVisible: boolean): void {
		let t = this.tagMap.get(tagName);
		if (t === undefined) {
			t = new Tag(null, null, isVisible);
			this.tagMap.set(tagName, t);
			return;
		}

		if (t.visMatch(isVisible))
			return;
		else
			this.tagMap.set(tagName, new Tag(t.colors, t.sizes, isVisible));
	}

	/**
	 * Get all tags for this entity
	 */
	getTagSet(): Map<string, Tag> {
		return this.tagMap;
	}

	/**
	 * Returns the global position at which entities depart from this entity, if relevant.
	 * Java の getSourcePoint()（= getSourcePoint(true)）と getSourcePoint(boolean dir)。
	 * @param dir - true = normal direction, false = reverse direction
	 * @return arrival location
	 */
	getSourcePoint(dir: boolean = true): Vec3d {
		if (this.usePointsInput() && this.pointsInput.getValue().length !== 0) {
			const points = this.pointsInput.getValue();
			let localPt = points[0];
			if (dir)
				localPt = points[points.length - 1];
			return this.getGlobalPosition(localPt);
		}
		return this.getGlobalPosition();
	}

	/**
	 * Returns the global position at which entities arrive at this entity, if relevant.
	 * Java の getSinkPoint()（= getSinkPoint(true)）と getSinkPoint(boolean dir)。
	 * @param dir - true = normal direction, false = reverse direction
	 * @return departure location
	 */
	getSinkPoint(dir: boolean = true): Vec3d {
		if (this.usePointsInput() && this.pointsInput.getValue().length !== 0) {
			const points = this.pointsInput.getValue();
			let localPt = points[0];
			if (!dir)
				localPt = points[points.length - 1];
			return this.getGlobalPosition(localPt);
		}
		return this.getGlobalPosition();
	}

	/**
	 * Returns the distance from the arrival/departure location at which an entity flow arrow
	 * begins or ends.
	 * @return distance from the arrival/departure location
	 */
	getRadius(): number {
		let scale = 1.0;
		const region = this.getCurrentRegion();
		if (region !== null)
			scale = region.getGlobalScale();
		if (this.usePointsInput())
			return 0.05 * scale;
		const ret = Math.min(this.getSize().x, this.getSize().y)/2.0 + 0.05;
		return ret * scale;
	}

	getMinRadius(): number {
		let scale = 1.0;
		const region = this.getCurrentRegion();
		if (region !== null)
			scale = region.getGlobalScale();
		return 0.05 * scale;
	}

	/** Java の getObserverList() と、出力の getObserverList(double simTime)（同じ結果） */
	getObserverList(_simTime?: number): ObserverEntity[] {
		return [];
	}

	getDestinationEntities(): DisplayEntity[] {
		return [];
	}

	getSourceEntities(): DisplayEntity[] {
		return [];
	}

	getDestinationDirEnts(dir: boolean): DirectedEntity[] {
		if (dir) {
			try {
				return DirectedEntity.getList(this.getDestinationEntities(), true);
			}
			catch (e) {
				// Java: catch (Exception e) {}
			}
		}
		return [];
	}

	getSourceDirEnts(dir: boolean): DirectedEntity[] {
		if (dir) {
			try {
				return DirectedEntity.getList(this.getSourceEntities(), true);
			}
			catch (e) {
				// Java: catch (Exception e) {}
			}
		}
		return [];
	}

	/**
	 * Java の getNextList(boolean dir) と、出力の getNextList(double simTime)（= getNextList(true)）。
	 * 数を渡すと出力の方になる。
	 */
	getNextList(dir: boolean | number): DirectedEntity[] {
		if (typeof dir === "number")
			return this.getNextList(true);
		const ret: DirectedEntity[] = [];
		ret.push(...this.getDestinationDirEnts(dir));
		const thisDe = new DirectedEntity(this, dir);
		for (const ent of this.getJaamSimModel().getClonesOfIterator(DisplayEntity)) {
			if (ent.getSourceDirEnts(true).some(d => d.equals(thisDe))) {
				ret.push(new DirectedEntity(ent, true));
			}
			if (ent.getSourceDirEnts(false).some(d => d.equals(thisDe))) {
				ret.push(new DirectedEntity(ent, false));
			}
		}
		return ret;
	}

	/**
	 * Java の getPreviousList(boolean dir) と、出力の getPreviousList(double simTime)（= getPreviousList(true)）。
	 * 数を渡すと出力の方になる。
	 */
	getPreviousList(dir: boolean | number): DirectedEntity[] {
		if (typeof dir === "number")
			return this.getPreviousList(true);
		const ret: DirectedEntity[] = [];
		ret.push(...this.getSourceDirEnts(dir));
		const thisDe = new DirectedEntity(this, dir);
		for (const ent of this.getJaamSimModel().getClonesOfIterator(DisplayEntity)) {
			if (ent.getDestinationDirEnts(true).some(d => d.equals(thisDe))) {
				ret.push(new DirectedEntity(ent, true));
			}
			if (ent.getDestinationDirEnts(false).some(d => d.equals(thisDe))) {
				ret.push(new DirectedEntity(ent, false));
			}
		}
		return ret;
	}

	/**
	 * Sets the region, position, and orientation to match the specified entity and offset.
	 * @param ent - entity whose position, etc. is to be matched
	 * @param offset - new position of this entity relative to the specified entity
	 */
	moveToProcessPosition(ent: DisplayEntity, offset: Vec3d): void {
		this.setRegion(ent.getCurrentRegion());
		const pos = ent.getGlobalPosition();
		pos.add3(offset);
		this.setGlobalPosition(pos);
		this.setRelativeOrientation(ent.getOrientation());
	}

	/**
	 * Returns the first parent that is visible in the chain of parents.
	 * @return first visible parent
	 */
	getVisibleParent(): DisplayEntity | null {
		let ent: Entity | null = this.getParent();
		while (ent !== null && ent !== undefined && ent instanceof DisplayEntity) {
			if (ent.getShow()) {
				return ent;
			}
			ent = ent.getParent();
		}
		return null;
	}

	// DragAndDropable interface

	getJavaClass(): JClass<Entity> {
		return this.constructor as JClass<Entity>;
	}

	isDragAndDrop(): boolean {

		// Cannot be a clone or a child
		if (this.isClone() || this.getParent() !== null)
			return false;

		// Already has one or more clones
		if (this.hasClone())
			return true;

		// Has at least one child that is not an EntityLabel
		for (const child of this.getChildren()) {
			if (LateClasses.isInstance(child, ENTITY_LABEL))
				continue;
			return true;
		}
		return false;
	}

	getLibraryName(): string {
		return DisplayEntity.LIBRARY_NAME;
	}

	/** 描画: 省略（three.js の画面を作るときに）。Java は getObjectType().getIconImage()（AWT の BufferedImage） */
	getIconImage(): unknown {
		return null;
	}

	////////////////////////////////////////////////////////////////////////
	// Outputs
	////////////////////////////////////////////////////////////////////////

	getRegionOutput(simTime: number): Region | null {
		return this.getCurrentRegion();
	}

	getPosOutput(simTime: number): Vec3d {
		return this.getPosition();
	}

	getSizeOutput(simTime: number): Vec3d {
		return this.getSize();
	}

	getOrientOutput(simTime: number): Vec3d {
		return this.getOrientation();
	}

	getAlignOutput(simTime: number): Vec3d {
		return this.getAlignment();
	}

	getShowOutput(simTime: number): boolean {
		return this.getShow(simTime);
	}

	getGraphicalLength(simTime: number): number {
		if (this.usePointsInput()) {
			return PolylineInfo.getLength(this.getCurvePoints());
		}
		const vec = this.getSize();
		return Math.max(Math.max(vec.x, vec.y), vec.z);
	}

	getEntityReferenceList(simTime: number): DisplayEntity[] {
		const list = this.getEntityReferences();
		const ret: DisplayEntity[] = [];
		for (const ent of list) {
			if (!(ent instanceof DisplayEntity) || ent === this
					|| LateClasses.isInstance(ent, OVERLAY_ENTITY) || LateClasses.isInstance(ent, REGION))
				continue;
			ret.push(ent);
		}
		return ret;
	}

	getEntityDependentList(simTime: number): DisplayEntity[] {
		const ret: DisplayEntity[] = [];
		for (const ent of this.getJaamSimModel().getClonesOfIterator(DisplayEntity)) {
			if (ent === this)
				continue;
			if (ent.getEntityReferences().includes(this)) {
				ret.push(ent);
			}
		}
		return ret;
	}

}

defineOutput(DisplayEntity, {
	name: "Region",
	description: "The present coordinate system in which the DisplayEntity's position and"
	           + "orientation are given.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "Entity",
	get: (e, simTime) => e.getRegionOutput(simTime),
});

defineOutput(DisplayEntity, {
	name: "Position",
	description: "The present {x, y, z} coordinates of the DisplayEntity in its Region.",
	unitType: DistanceUnit, reportable: false, sequence: 2,
	returnType: "Vec3d",
	get: (e, simTime) => e.getPosOutput(simTime),
});

defineOutput(DisplayEntity, {
	name: "Size",
	description: "The present {x, y, z} components of the DisplayEntity's size.",
	unitType: DistanceUnit, reportable: false, sequence: 3,
	returnType: "Vec3d",
	get: (e, simTime) => e.getSizeOutput(simTime),
});

defineOutput(DisplayEntity, {
	name: "Orientation",
	description: "The present {x, y, z} Euler angles of the DisplayEntity's rotation.",
	unitType: AngleUnit, reportable: false, sequence: 4,
	returnType: "Vec3d",
	get: (e, simTime) => e.getOrientOutput(simTime),
});

defineOutput(DisplayEntity, {
	name: "Alignment",
	description: "The present {x, y, z} coordinates of a point on the DisplayEntity that aligns "
	           + "direction with the position output. Each component should be in the range "
	           + "[-0.5, 0.5].",
	unitType: DimensionlessUnit, reportable: false, sequence: 5,
	returnType: "Vec3d",
	get: (e, simTime) => e.getAlignOutput(simTime),
});

defineOutput(DisplayEntity, {
	name: "Show",
	description: "Returns TRUE if the object is shown in one or more view windows.",
	unitType: DimensionlessUnit, reportable: false, sequence: 6,
	returnType: "boolean",
	get: (e, simTime) => e.getShowOutput(simTime),
});

defineOutput(DisplayEntity, {
	name: "GraphicalLength",
	description: "Polyline type objects: the length of the polyline determined by its "
	           + "Points and CurveType inputs.\n"
	           + "Non-polyline type objects: the largest of the Size inputs.",
	unitType: DistanceUnit, reportable: false, sequence: 7,
	returnType: "double",
	get: (e, simTime) => e.getGraphicalLength(simTime),
});

defineOutput(DisplayEntity, {
	name: "ObserverList",
	description: "The observers that are monitoring the state of this entity.",
	unitType: DimensionlessUnit, reportable: false, sequence: 8,
	returnType: "ArrayList",
	get: (e, simTime) => e.getObserverList(simTime),
});

defineOutput(DisplayEntity, {
	name: "NextList",
	description: "The entities that are immediately downstream from this entity.",
	unitType: DimensionlessUnit, reportable: false, sequence: 9,
	returnType: "ArrayList",
	get: (e, simTime) => e.getNextList(simTime),
});

defineOutput(DisplayEntity, {
	name: "PreviousList",
	description: "The entities that are immediately upstream from this entity.",
	unitType: DimensionlessUnit, reportable: false, sequence: 10,
	returnType: "ArrayList",
	get: (e, simTime) => e.getPreviousList(simTime),
});

defineOutput(DisplayEntity, {
	name: "EntityReferenceList",
	description: "The entities that appear in the inputs to this entity.",
	unitType: DimensionlessUnit, reportable: false, sequence: 11,
	returnType: "ArrayList",
	get: (e, simTime) => e.getEntityReferenceList(simTime),
});

defineOutput(DisplayEntity, {
	name: "EntityDependentList",
	description: "The entities whose inputs include one or more references to this entity.",
	unitType: DimensionlessUnit, reportable: false, sequence: 12,
	returnType: "ArrayList",
	get: (e, simTime) => e.getEntityDependentList(simTime),
});

ClassRegistry.register("com.jaamsim.Graphics.DisplayEntity", DisplayEntity);
LateClasses.bind("com.jaamsim.Graphics.DisplayEntity", DisplayEntity);
