//@@HEADER@@
import { LateClasses } from "../Graphics/LateClasses.ts";
import { Entity } from "../basicsim/Entity.ts";
import { Log } from "../basicsim/Log.ts";
import { ActionListInput } from "../input/ActionListInput.ts";
import { FileInput } from "../input/FileInput.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { jEqualsIgnoreCase } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DisplayModel } from "./DisplayModel.ts";

/*
 * 移植の注意:
 * - 描画: 省略（three.js の画面を作るときに）。3D のモデルの読み込み（ColParser・MeshData・MeshProtoKey・
 *   MeshDataCache・RenderManager）と、入れ子のクラス Binding は移さない。
 *   - getCachedMeshKey と _cachedKeys（ファイル → MeshProtoKey）は描画の部品なので消した。
 *   - 出力 Vertices・Triangles・VertexShareRatio・NumSubInstances・NumSubMeshes は、Java でモデルが
 *     まだ読み込まれていないとき（getMeshData() が null）と同じく 0 を返す。
 *   - 出力 Actions・Durations は、Java で描画が無いとき（RenderManager.isGood() が false）と同じく空を返す。
 *   - validate の Actions の確かめも、Java で描画が無いときと同じく行わない。
 *   - exportBinaryMesh（JSB への書き出し）は移さない。
 */

export class ColladaModel extends DisplayModel {

	private readonly colladaFile: FileInput;

	private readonly actions: ActionListInput;

	static readonly VALID_FILE_EXTENSIONS: string[] = ["ZIP", "DAE", "GLTF", "GLB", "OBJ", "JSM", "JSB"];
	static readonly VALID_FILE_DESCRIPTIONS: string[] = [
			"Zipped 3D Files (*.zip)",
			"COLLADA Files (*.dae)",
			"GLTF Files (*.gltf)",
			"GLTF Binary Files (*.glb)",
			"Wavefront Files (*.obj)",
			"JaamSim 3D Files (*.jsm)",
			"JaamSim 3D Binary Files (*.jsb)"];

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.colladaFile = new FileInput( "ColladaFile", Entity.KEY_INPUTS, null );
		this.setKeywordDoc(this.colladaFile, "The file containing the 3d object to show, valid formats are: "
				+ "DAE, OBJ, JSM, and JSB, or a compressed version of any of these files in ZIP format.",
				["..\\graphics\\ship.dae", "..\\graphics\\ship.dae.zip" ]);
		this.colladaFile.setFileType("3D");
		this.colladaFile.setValidFileExtensions(ColladaModel.VALID_FILE_EXTENSIONS);
		this.colladaFile.setValidFileDescriptions(ColladaModel.VALID_FILE_DESCRIPTIONS);
		this.addInput( this.colladaFile);

		this.actions = new ActionListInput("Actions", Entity.KEY_INPUTS, []);
		this.setKeywordDoc(this.actions, "Entity outputs that drive the animated actions for the ColladaModel. "
				+ "The actions for a ColladaModel are defined as part of its ColladaFile input. "
				+ "They are listed in the 'Actions' output for the ColladaModel. ",
				[ "{ ContentAction Contents } { BoomAngleAction BoomAngle }" ]);
		this.addInput(this.actions);
	}

	/** 描画: 省略（three.js の画面を作るときに）。Java は new Binding(ent, this) */
	override getBinding(ent: Entity): object | null {
		return null;
	}

	override canDisplayEntity(ent: Entity): boolean {
		return LateClasses.isInstance(ent, "com.jaamsim.Graphics.DisplayEntity");
	}

	getColladaFile(): ReturnType<FileInput["getValue"]> {
		return this.colladaFile.getValue();
	}

	/**
	 * Compares the specified file extension to the list of valid extensions.
	 *
	 * @param str - the file extension to be tested.
	 * @return - TRUE if the extension is valid.
	 */
	static isValidExtension(str: string): boolean {

		for (const ext of ColladaModel.VALID_FILE_EXTENSIONS) {
			if (jEqualsIgnoreCase(str, ext))
				return true;
		}
		return false;
	}

	/** 描画: 省略（three.js の画面を作るときに）。Java は MeshDataCache から読み込んだ 3D のデータを返す */
	private getMeshData(): { getNumVertices(): number; getNumTriangles(): number;
			getNumSubInstances(): number; getNumSubMeshes(): number } | null {
		return null;
	}

	getNumVerticesOutput(simTime: number): number {
		const data = this.getMeshData();
		if (data === null) return 0;

		return data.getNumVertices();
	}

	getNumTrianglesOutput(simTime: number): number {
		const data = this.getMeshData();
		if (data === null) return 0;

		return data.getNumTriangles();
	}

	getVertexShareRatioOutput(simTime: number): number {
		const data = this.getMeshData();
		if (data === null) return 0;

		const numTriangles = data.getNumTriangles();
		const numVertices = data.getNumVertices();
		return numTriangles / (numVertices/3);
	}

	getNumSubInstancesOutput(simTime: number): number {
		const data = this.getMeshData();
		if (data === null) return 0;

		return data.getNumSubInstances();

	}

	getNumSubMeshesOutput(simTime: number): number {
		const data = this.getMeshData();
		if (data === null) return 0;

		return data.getNumSubMeshes();

	}

	override validate(): void {
		super.validate();

		// 描画: 省略（three.js の画面を作るときに）。Java は RenderManager.isGood() が false なら、ここで戻る。
		// 描画があるときは、Actions の名前が ColladaFile の中にあるかを確かめる
		// （無ければ InputErrorException "Input to the Action keyword refers to an action named '%s' that is not specified by the ColladaFile input."）。
		return;
	}

	getActionsOutput(simTime: number): string[] {
		const ret: string[] = [];
		// 描画: 省略。Java は RenderManager.isGood() が false か ColladaFile が無ければ空を返す
		return ret;
	}

	getDurationsOutput(simTime: number): number[] {
		// 描画: 省略。Java は RenderManager.isGood() が false か ColladaFile が無ければ空を返す
		return [];
	}

	/** 描画: 省略（three.js の画面を作るときに）。3D のモデルを JSB 形式で書き出す */
	exportBinaryMesh(outputName: string): void {
		// TODO(移植): ColParser・BlockWriter が無いので書き出せない
		Log.format("Could not export model. Error: %s\n", "not supported");
	}

}

defineOutput(ColladaModel, {
	name: "Vertices",
	description: "Number of vertices contained in the 3D model.",
	unitType: DimensionlessUnit, reportable: false, sequence: 2,
	returnType: "int",
	get: (e, simTime) => e.getNumVerticesOutput(simTime),
});

defineOutput(ColladaModel, {
	name: "Triangles",
	description: "Number of triangles contained in the 3D model.",
	unitType: DimensionlessUnit, reportable: false, sequence: 3,
	returnType: "int",
	get: (e, simTime) => e.getNumTrianglesOutput(simTime),
});

defineOutput(ColladaModel, {
	name: "VertexShareRatio",
	description: "Number of triangles divided by one-third of the number of vertices. "
	           + "A value > 1 indicates that vertices were shared between multiple triangles.",
	unitType: DimensionlessUnit, reportable: false, sequence: 4,
	returnType: "double",
	get: (e, simTime) => e.getVertexShareRatioOutput(simTime),
});

defineOutput(ColladaModel, {
	name: "NumSubInstances",
	description: "Number of subinstances contained in the 3D model.",
	unitType: DimensionlessUnit, reportable: false, sequence: 5,
	returnType: "int",
	get: (e, simTime) => e.getNumSubInstancesOutput(simTime),
});

defineOutput(ColladaModel, {
	name: "NumSubMeshes",
	description: "Number of submeshes contained in the 3D model.",
	unitType: DimensionlessUnit, reportable: false, sequence: 6,
	returnType: "int",
	get: (e, simTime) => e.getNumSubMeshesOutput(simTime),
});

defineOutput(ColladaModel, {
	name: "Actions",
	description: "Names of the animations contained in the 3D model.",
	unitType: DimensionlessUnit, reportable: false, sequence: 1,
	returnType: "ArrayList",
	get: (e, simTime) => e.getActionsOutput(simTime),
});

defineOutput(ColladaModel, {
	name: "Durations",
	description: "Durations of the animations contained in the 3D model.",
	unitType: DimensionlessUnit, reportable: false, sequence: 2,
	returnType: "double[]",
	get: (e, simTime) => e.getDurationsOutput(simTime),
});

ClassRegistry.register("com.jaamsim.DisplayModels.ColladaModel", ColladaModel);
LateClasses.bind("com.jaamsim.DisplayModels.ColladaModel", ColladaModel);
