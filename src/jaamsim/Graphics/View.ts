/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2018-2026 JaamSim Software Inc.
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
 * TypeScript への移植 (C) 2026 shota
 */
import { BooleanProvInput } from "../internal.ts";
import { KeywordCommand } from "../internal.ts";
import { Entity } from "../internal.ts";
import type { WindowDefaults } from "../basicsim/WindowDefaults.ts";
import { IntegerVector } from "../internal.ts";
import { EntityInput } from "../internal.ts";
import { FileInput } from "../internal.ts";
import { IntegerListInput } from "../internal.ts";
import { KeyedVec3dInput } from "../internal.ts";
import { KeywordIndex } from "../internal.ts";
import { defineOutput } from "../internal.ts";
import { StringInput } from "../internal.ts";
import { Vec3dInput } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { MathUtils } from "../internal.ts";
import { Vec3d } from "../internal.ts";
import { Vec4d } from "../internal.ts";
import { DistanceUnit } from "../internal.ts";
import type { DisplayEntity } from "./DisplayEntity.ts";
import { LateClasses } from "../internal.ts";
import type { Region } from "./Region.ts";

/*
 * 移植の注意:
 * - View は Entity の子（DisplayEntity ではない）。Region・DisplayEntity は、読み込みの輪を避けるため
 *   実行時には LateClasses から引く。
 * - viewCounter（AtomicInteger）は static の数にした。
 * - 窓を開く・閉じる（GUIListener の addView・createWindow など）は GUIListener があるときだけ呼ぶ（Java と同じ）。
 *   描画: 窓そのものは three.js の画面を作るときに。
 * - 入力のフィールド showWindow は、関数 showWindow() と名前がぶつかるので showWindowInput にした。
 * - 出力の関数 geDistanceToPOI は Java の綴りのまま（"get" ではない）。
 */

const defPos = new IntegerVector(2);
const defSize = new IntegerVector(2);
defPos.fillWithEntriesOf(2, 0);
defSize.fillWithEntriesOf(2, 0);

export class View extends Entity {

	static readonly OMNI_VIEW_ID = -1;
	static readonly NO_VIEW_ID = 0;

	private static viewCounter = 1;
	private readonly viewID: number;

	private readonly region: EntityInput<Region>;

	private readonly center: Vec3dInput;

	private readonly position: Vec3dInput;

	private readonly direction: Vec3dInput;

	private readonly windowSize: IntegerListInput;

	private readonly windowPos: IntegerListInput;

	private readonly titleBar: StringInput;

	private readonly showWindowInput: BooleanProvInput;  // Java の showWindow（関数 showWindow() と名前がぶつかるため）

	private readonly movable: BooleanProvInput;

	private readonly lock2D: BooleanProvInput;

	private readonly followEntityInput: EntityInput<DisplayEntity>;

	private readonly positionScriptInput: KeyedVec3dInput;

	private readonly centerScriptInput: KeyedVec3dInput;

	private readonly directionScriptInput: KeyedVec3dInput;

	private readonly skyboxImage: FileInput;

	private readonly poi = new Vec3d();

	private static readonly DIR_ISO = new Vec3d(-1/Math.sqrt(3), 1/Math.sqrt(3), -1/Math.sqrt(3));
	private static readonly DIR_2D = new Vec3d(0.0, 0.0, -1.0);

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.active.setDefaultValue(false);

		this.attributeDefinitionList.setHidden(true);
		this.namedExpressionInput.setHidden(true);

		this.region = new EntityInput<Region>(LateClasses.get<Region>("com.jaamsim.Graphics.Region"),
				"Region", Entity.GRAPHICS, null);
		this.setKeywordDoc(this.region, "The region in which the view's coordinates are given.", []);
		this.addInput(this.region);

		this.center = new Vec3dInput("ViewCenter", Entity.GRAPHICS, new Vec3d());
		this.setKeywordDoc(this.center, "The position at which the view camera is pointed.",
				["0 0 0 m"]);
		this.center.setUnitType(DistanceUnit);
		this.center.setPromptReqd(false);
		this.center.setHidden(true);
		this.addInput(this.center);

		this.position = new Vec3dInput("ViewPosition", Entity.GRAPHICS, new Vec3d(10.0, -10.0, 10.0));
		this.setKeywordDoc(this.position, "The position of the view camera.",
				["0 0 50 m"]);
		this.position.setUnitType(DistanceUnit);
		this.position.setPromptReqd(false);
		this.addInput(this.position);

		this.direction = new Vec3dInput("ViewDirection", Entity.GRAPHICS, View.DIR_ISO);
		this.setKeywordDoc(this.direction, "Unit vector pointing in the direction of the view camera.",
				["0 0 -1 m"]);
		this.direction.setUnitType(DistanceUnit);
		this.direction.setPromptReqd(false);
		this.addInput(this.direction);

		this.windowSize = new IntegerListInput("WindowSize", Entity.GRAPHICS, defSize);
		this.setKeywordDoc(this.windowSize, "The size of the window in pixels (width, height).",
				["500 300"]);
		this.windowSize.setValidCount(2);
		this.windowSize.setValidRange(1, 8192);
		this.windowSize.setPromptReqd(false);
		this.addInput(this.windowSize);

		this.windowPos = new IntegerListInput("WindowPosition", Entity.GRAPHICS, defPos);
		this.setKeywordDoc(this.windowPos, "The position of the upper left corner of the window in pixels "
		                     + "measured from the top left corner of the screen.",
				["220 110"]);
		this.windowPos.setValidCount(2);
		this.windowPos.setValidRange(-8192, 8192);
		this.windowPos.setPromptReqd(false);
		this.addInput(this.windowPos);

		this.titleBar = new StringInput("TitleBarText", Entity.GRAPHICS, null);
		this.setKeywordDoc(this.titleBar, "Text to place in the title bar of the view window. The window must "
		                     + "be closed and re-opened manually after changing the title.",
				["'An Example Title'"]);
		this.addInput(this.titleBar);

		this.showWindowInput = new BooleanProvInput("ShowWindow", Entity.GRAPHICS, false);
		this.setKeywordDoc(this.showWindowInput, "If TRUE, the view window is displayed on screen.", []);
		this.showWindowInput.setPromptReqd(false);
		this.addInput(this.showWindowInput);

		this.movable = new BooleanProvInput("Movable", Entity.GRAPHICS, true);
		this.setKeywordDoc(this.movable, "A Boolean indicating whether the view can be panned or rotated.", []);
		this.addInput(this.movable);

		this.lock2D = new BooleanProvInput("Lock2D", Entity.GRAPHICS, false);
		this.setKeywordDoc(this.lock2D, "A Boolean indicating whether the view is locked to a downward view "
		                     + "(the 2D default).", []);
		this.addInput(this.lock2D);

		this.followEntityInput = new EntityInput<DisplayEntity>(
				LateClasses.get<DisplayEntity>("com.jaamsim.Graphics.DisplayEntity"), "FollowEntity", Entity.GRAPHICS, null);
		this.setKeywordDoc(this.followEntityInput, "The (optional) entity for this view to follow. Setting this input "
		                     + "makes the view ignore ViewCenter and interprets ViewPosition as a "
		                     + "relative offset to this entity.", []);
		this.addInput(this.followEntityInput);

		this.positionScriptInput = new KeyedVec3dInput("ScriptedViewPosition", Entity.GRAPHICS);
		this.setKeywordDoc(this.positionScriptInput, "The (optional) scripted curve for the view position to follow.",
				["{{ 0 h } { 0 0 0 m }} {{ 100 h } { 100 0 0 m }}"]);
		this.positionScriptInput.setUnitType(DistanceUnit);
		this.addInput(this.positionScriptInput);

		this.centerScriptInput = new KeyedVec3dInput("ScriptedViewCenter", Entity.GRAPHICS);
		this.setKeywordDoc(this.centerScriptInput, "The (optional) scripted curve for the view center to follow.",
				["{{ 0 h } { 0 0 0 m }} {{ 100 h } { 100 0 0 m }}"]);
		this.centerScriptInput.setUnitType(DistanceUnit);
		this.centerScriptInput.setHidden(true);
		this.addInput(this.centerScriptInput);

		this.directionScriptInput = new KeyedVec3dInput("ScriptedViewDirection", Entity.GRAPHICS);
		this.setKeywordDoc(this.directionScriptInput, "The (optional) scripted curve for the view direction to follow.",
				["{{ 0 h } { 0 0 -1 m }} {{ 100 h } { 0 0.707107 -0.707107 m }}"]);
		this.directionScriptInput.setUnitType(DistanceUnit);
		this.directionScriptInput.setSphericalInterpolation(true);
		this.addInput(this.directionScriptInput);

		this.skyboxImage = new FileInput("SkyboxImage", Entity.GRAPHICS, null);
		this.setKeywordDoc(this.skyboxImage, "The image file to use as the background for this view.",
				["'<res>/images/sky_map_2048x1024.jpg'"]);
		this.addInput(this.skyboxImage);

		// ---- Java のコンストラクタの中身 ----
		this.viewID = ++View.viewCounter;
		const gui = this.getJaamSimModel().getGUIListener();
		if (gui === null || gui === undefined) {
			return;
		}
		gui.addView(this);
	}

	override kill(): void {
		super.kill();
		const gui = this.getJaamSimModel().getGUIListener();
		if (gui === null || gui === undefined)
			return;
		gui.removeView(this);
		gui.closeWindow(this);
	}

	override restore(): void {
		super.restore();
		const gui = this.getJaamSimModel().getGUIListener();
		if (gui === null || gui === undefined)
			return;
		gui.addView(this);
		gui.createWindow(this);
	}

	static setDefaults(winDefs: WindowDefaults): void {
		defPos.set(0, winDefs.COL2_START);
		defPos.set(1, winDefs.TOP_START);

		defSize.set(0, winDefs.VIEW_WIDTH);
		defSize.set(1, winDefs.VIEW_HEIGHT);
	}

	getViewPosition(): Vec3d {
		return this.position.getValue()!;
	}


	/** Java の getPointOfInterest() と、出力の getPointOfInterest(double simTime)（同じ結果） */
	getPointOfInterest(_simTime?: number): Vec3d {
		return this.poi;
	}

	setPointOfInterest(pos: Vec3d): void {
		this.poi.set3(pos);
	}

	getViewDirection(): Vec3d {
		if (this.direction.getIsDef() && !this.center.getIsDef()) {
			const ret = new Vec3d();
			ret.sub3(this.center.getValue()!, this.getViewPosition());
			ret.normalize3();
			return ret;
		}
		return this.direction.getValue()!;
	}

	/**
	 * Returns the point on the xy-plane at which the camera is aimed.
	 * @return point on the xy-plane
	 */
	getEffViewCenter(): Vec3d {
		const camPos = this.getViewPosition();
		const camDir = this.getViewDirection();
		if (MathUtils.near(camDir.z, 0.0))
			return new Vec3d(camPos.x, camPos.y, 0.0);
		const factor = camPos.z/camDir.z;
		const ret = new Vec3d(camDir);
		ret.scale3(factor);
		ret.sub3(camPos, ret);
		return ret;
	}

	getGlobalDirection(simTime: number): Vec3d {

		// Check if this is following a script
		if (this.directionScriptInput.hasKeys()) {
			const ret = this.directionScriptInput.getValueForTime(simTime)!;
			ret.normalize3();
			return ret;
		}
		if (this.centerScriptInput.hasKeys()) {
			const ret = new Vec3d();
			ret.sub3(this.centerScriptInput.getValueForTime(simTime)!, this.getGlobalPosition(simTime));
			ret.normalize3();
			return ret;
		}

		const tmp = this.getViewDirection();
		const ret = new Vec4d(tmp.x, tmp.y, tmp.z, 1.0);
		if (this.region.getValue() !== null) {
			const regTrans = this.region.getValue()!.getRegionTrans();
			regTrans.apply(ret, ret);
		}
		return ret;
	}

	getGlobalPosition(simTime: number): Vec3d {

		// Check if this is following a script
		if (this.positionScriptInput.hasKeys()) {
			return this.positionScriptInput.getValueForTime(simTime)!;
		}

		// Is this view following an entity?
		const follow = this.followEntityInput.getValue()!;
		if (follow !== null) {
			const ret = follow.getGlobalPosition();
			ret.add3(this.position.getValue()!);
			return ret;
		}

		const tmp = this.getViewPosition();
		const ret = new Vec4d(tmp.x, tmp.y, tmp.z, 1.0);
		if (this.region.getValue() !== null) {
			const regTrans = this.region.getValue()!.getRegionTrans();
			regTrans.apply(ret, ret);
		}
		return ret;
	}

	/** Java の getGlobalCenter()（今の時刻）と getGlobalCenter(double simTime) */
	getGlobalCenter(simTime?: number): Vec3d {
		if (simTime === undefined)
			return this.getGlobalCenter(this.getJaamSimModel().getSimTime());
		const tmp = this.getEffViewCenter();
		const ret = new Vec4d(tmp.x, tmp.y, tmp.z, 1.0);
		if (this.region.getValue() !== null) {
			const regTrans = this.region.getValue()!.getRegionTrans();
			regTrans.apply(ret, ret);
		}
		return ret;
	}

	/**
	 * updateCenterAndPos is used only by the mouse interaction code. It takes the camera view center and camera position in global
	 * coordinates and sets the corresponding inputs (in region coordinates).
	 * @param pos - camera position in world coordinates
	 * @param dir - camera direction in world coordinates
	 */
	updateCenterAndPos(pos: Vec3d, dir: Vec3d): void {
		const tempPos = new Vec3d(pos);
		const tempDir = new Vec3d(dir);

		if (this.region.getValue() !== null) {
			const regTrans = this.region.getValue()!.getRegionTrans();
			regTrans.inverse(regTrans);
			regTrans.multAndTrans(pos, tempPos);
			tempDir.mult3(regTrans.getMat4dRef(), dir);
		}

		// If this is following an entity, subtract that entity's position from the camera position (as it is interpreted as relative)

		if (this.isFollowing()) {
			tempPos.sub3(this.followEntityInput.getValue()!.getGlobalPosition(), tempPos);
		}

		const posKw = KeywordIndex.formatVec3dInput(this, this.position.getKeyword(), tempPos, DistanceUnit);
		const ctrKw = KeywordIndex.formatVec3dInput(this, this.direction.getKeyword(), tempDir, DistanceUnit);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, posKw, ctrKw));

		// Ignore the 'ViewCenter' input if is was entered as an input
		this.center.reset();
	}

	getTitle(): string {
		if (this.titleBar.getValue() !== null)
			return this.titleBar.getValue()!;
		else
			return this.getName();
	}

	showWindow(): boolean {
		return this.showWindowInput.getNextBoolean(this, 0.0);
	}

	getRegion(): Region | null {
		return this.region.getValue()!;
	}

	setWindowPosSize(x: number, y: number, width: number, height: number): void {
		const kwList: KeywordIndex[] = [];

		const pos = this.windowPos.getValue()!;
		if (pos.get(0) !== x || pos.get(1) !== y) {
			const posKw = KeywordIndex.formatIntegers(this.windowPos.getKeyword(), x, y);
			kwList.push(posKw);
		}

		const size = this.windowSize.getValue()!;
		if (size.get(0) !== width || size.get(1) !== height) {
			const sizeKw = KeywordIndex.formatIntegers(this.windowSize.getKeyword(), width, height);
			kwList.push(sizeKw);
		}

		if (kwList.length === 0)
			return;

		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, ...kwList));
	}

	getWindowPosSize(): IntegerVector {
		const ret = new IntegerVector(4);
		const pos = this.windowPos.getValue()!;
		const size = this.windowSize.getValue()!;

		ret.add(pos.get(0));
		ret.add(pos.get(1));
		ret.add(size.get(0));
		ret.add(size.get(1));
		return ret;
	}

	getID(): number {
		return this.viewID;
	}

	isMovable(): boolean {
		return this.movable.getNextBoolean(this, 0.0);
	}

	isFollowing(): boolean {
		return this.followEntityInput.getValue() !== null;
	}

	isScripted(): boolean {
		return this.positionScriptInput.hasKeys() || this.directionScriptInput.hasKeys()
				|| this.centerScriptInput.hasKeys();
	}

	setLock2D(bLock2D: boolean): void {

		// Set the Lock2D keyword
		const kw = KeywordIndex.formatBoolean(this.lock2D.getKeyword(), bLock2D);

		// Set the camera position
		const viewCenter = this.getEffViewCenter();
		const camPos = this.getViewPosition();
		const vec = new Vec3d();
		vec.sub3(viewCenter, camPos);
		let dist = vec.mag3();
		const pos = new Vec3d(viewCenter);

		let dir: Vec3d;
		if (bLock2D) {
			pos.z += dist;
			dir = View.DIR_2D;
		}
		else {
			dist = dist/Math.sqrt(3);
			pos.x += dist;
			pos.y -= dist;
			pos.z += dist;
			dir = View.DIR_ISO;
		}
		const posKw = KeywordIndex.formatVec3dInput(this, this.position.getKeyword(), pos, DistanceUnit);
		const dirKw = KeywordIndex.formatVec3dInput(this, this.direction.getKeyword(), dir, DistanceUnit);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw, posKw, dirKw));

		// Ignore the 'ViewCenter' input if is was entered as an input
		this.center.reset();
	}

	is2DLocked(): boolean {
		return this.lock2D.getNextBoolean(this, 0.0);
	}

	getSkyboxTexture(): ReturnType<FileInput["getValue"]> | null {
		const file = this.skyboxImage.getValue()!;
		if (file === null || file === undefined || String(file) === "") {
			return null;
		}
		return file;
	}

	geDistanceToPOI(simTime: number): number {
		const vec = new Vec3d(this.getViewPosition());
		vec.sub3(this.getPointOfInterest());
		return vec.mag3();
	}

}

defineOutput(View, {
	name: "PointOfInterest",
	description: "The point at which the view will zoom towards or rotate around.",
	unitType: DistanceUnit, reportable: false, sequence: 1,
	returnType: "Vec3d",
	get: (e, simTime) => e.getPointOfInterest(simTime),
});

defineOutput(View, {
	name: "DistanceToPOI",
	description: "The distance from the camera position to the point of interest.",
	unitType: DistanceUnit, reportable: false, sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.geDistanceToPOI(simTime),
});

ClassRegistry.register("com.jaamsim.Graphics.View", View);
LateClasses.bind("com.jaamsim.Graphics.View", View);
