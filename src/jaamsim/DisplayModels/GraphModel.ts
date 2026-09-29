/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2013 Ausenco Engineering Canada Inc.
 * Copyright (C) 2025 JaamSim Software Inc.
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
import { ColourProvInput } from "../ColourProviders/ColourProvInput.ts";
import { LateClasses } from "../Graphics/LateClasses.ts";
import { Entity } from "../basicsim/Entity.ts";
import { ColourInput } from "../input/ColourInput.ts";
import { EntityInput } from "../input/EntityInput.ts";
import { ValueInput } from "../input/ValueInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DisplayModel } from "./DisplayModel.ts";
import { TextModel } from "./TextModel.ts";

/*
 * 移植の注意:
 * - 描画: 省略（three.js の画面を作るときに）。入れ子のクラス Binding（枠・題・軸・目盛り・格子線・
 *   折れ線と棒の描き方。Java の 226 行目から最後まで）は移さない。要点は docs/todo-F.md に書いた。
 *   そのため、下の入力の値を読む関数は Java にも無く、今は読む所が無い（three.js の画面を作るときに足す）。
 */

export class GraphModel extends DisplayModel {

	private readonly titleTextHeight: ValueInput;

	private readonly xAxisTitleTextHeight: ValueInput;

	private readonly yAxisTitleTextHeight: ValueInput;

	private readonly labelTextHeight: ValueInput;

	private readonly titleGap: ValueInput;

	private readonly xAxisTitleGap: ValueInput;

	private readonly xAxisLabelGap: ValueInput;

	private readonly yAxisTitleGap: ValueInput;

	private readonly yAxisLabelGap: ValueInput;

	private readonly topMargin: ValueInput;

	private readonly bottomMargin: ValueInput;

	private readonly leftMargin: ValueInput;

	private readonly rightMargin: ValueInput;

	protected readonly titleTextModel: EntityInput<TextModel>;

	protected readonly axisTitleTextModel: EntityInput<TextModel>;

	protected readonly labelTextModel: EntityInput<TextModel>;

	private readonly graphColor: ColourProvInput;

	private readonly backgroundColor: ColourProvInput;

	private readonly borderColor: ColourProvInput;

	private static readonly maxTicks = 100;

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		this.titleTextHeight = new ValueInput("TitleTextHeight", Entity.KEY_INPUTS, 0.05);
		this.setKeywordDoc(this.titleTextHeight, "The text height for the graph title.",
				["0.05"]);
		this.titleTextHeight.setUnitType(DimensionlessUnit);
		this.addInput(this.titleTextHeight);

		this.xAxisTitleTextHeight = new ValueInput("XAxisTitleTextHeight", Entity.KEY_INPUTS, 0.05);
		this.setKeywordDoc(this.xAxisTitleTextHeight, "The text height for the x-axis title.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.05"]);
		this.xAxisTitleTextHeight.setUnitType(DimensionlessUnit);
		this.addInput(this.xAxisTitleTextHeight);

		this.yAxisTitleTextHeight = new ValueInput("YAxisTitleTextHeight", Entity.KEY_INPUTS, 0.05);
		this.setKeywordDoc(this.yAxisTitleTextHeight, "The text height for the y-axis title.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.05"]);
		this.yAxisTitleTextHeight.setUnitType(DimensionlessUnit);
		this.addInput(this.yAxisTitleTextHeight);

		this.labelTextHeight = new ValueInput("LabelTextHeight", Entity.KEY_INPUTS, 0.025);
		this.setKeywordDoc(this.labelTextHeight, "The text height for both x- and y-axis labels.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.025"]);
		this.labelTextHeight.setUnitType(DimensionlessUnit);
		this.addInput(this.labelTextHeight);

		this.titleGap = new ValueInput("TitleGap", Entity.KEY_INPUTS, 0.05);
		this.setKeywordDoc(this.titleGap, "The gap between the title and top of the graph.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.025"]);
		this.titleGap.setUnitType(DimensionlessUnit);
		this.addInput(this.titleGap);

		this.xAxisTitleGap = new ValueInput("XAxisTitleGap", Entity.KEY_INPUTS, 0.025);
		this.setKeywordDoc(this.xAxisTitleGap, "The gap between the x-axis title and the x-axis labels.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.025"]);
		this.xAxisTitleGap.setUnitType(DimensionlessUnit);
		this.addInput(this.xAxisTitleGap);

		this.xAxisLabelGap = new ValueInput("XAxisLabelGap", Entity.KEY_INPUTS, 0.025);
		this.setKeywordDoc(this.xAxisLabelGap, "The gap between the x-axis labels and the x-axis.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.025"]);
		this.xAxisLabelGap.setUnitType(DimensionlessUnit);
		this.addInput(this.xAxisLabelGap);

		this.yAxisTitleGap = new ValueInput("YAxisTitleGap", Entity.KEY_INPUTS, 0.025);
		this.setKeywordDoc(this.yAxisTitleGap, "The gap between the y-axis title and the y-axis labels.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.025"]);
		this.yAxisTitleGap.setUnitType(DimensionlessUnit);
		this.addInput(this.yAxisTitleGap);

		this.yAxisLabelGap = new ValueInput("YAxisLabelGap", Entity.KEY_INPUTS, 0.025);
		this.setKeywordDoc(this.yAxisLabelGap, "The gap between the y-axis and its labels.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.025"]);
		this.yAxisLabelGap.setUnitType(DimensionlessUnit);
		this.addInput(this.yAxisLabelGap);

		this.topMargin = new ValueInput("TopMargin", Entity.KEY_INPUTS, 0.15);
		this.setKeywordDoc(this.topMargin, "The margin between the top of the graph and the top of the graph object.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.10"]);
		this.topMargin.setUnitType(DimensionlessUnit);
		this.addInput(this.topMargin);

		this.bottomMargin = new ValueInput("BottomMargin", Entity.KEY_INPUTS, 0.175);
		this.setKeywordDoc(this.bottomMargin, "The margin between the bottom of the graph and the bottom of the graph object.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.10"]);
		this.bottomMargin.setUnitType(DimensionlessUnit);
		this.addInput(this.bottomMargin);

		this.leftMargin = new ValueInput("LeftMargin", Entity.KEY_INPUTS, 0.21);
		this.setKeywordDoc(this.leftMargin, "The margin between the left side of the graph and the left side of the graph object.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.20"]);
		this.leftMargin.setUnitType(DimensionlessUnit);
		this.addInput(this.leftMargin);

		this.rightMargin = new ValueInput("RightMargin", Entity.KEY_INPUTS, 0.21);
		this.setKeywordDoc(this.rightMargin, "The margin between the right side of the graph and the right side of the graph object.\n"
		                     + "Expressed as a fraction of the total graph height.",
				["0.20"]);
		this.rightMargin.setUnitType(DimensionlessUnit);
		this.addInput(this.rightMargin);

		this.titleTextModel = new EntityInput<TextModel>(TextModel, "TitleTextModel", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.titleTextModel, "The text model to be used for the graph title.\n"
		                     + "Determines the font, color, and style (bold, italics) for the text.",
				["TextModelDefault"]);
		this.addInput(this.titleTextModel);

		this.axisTitleTextModel = new EntityInput<TextModel>(TextModel, "AxisTitleTextModel", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.axisTitleTextModel, "The text model to be used for the axis titles (x-axis, y-axis, and secondary y-axis).\n"
		                     + "Determines the font, color, and style (bold, italics) for the text.",
				["TextModelDefault"]);
		this.addInput(this.axisTitleTextModel);

		this.labelTextModel = new EntityInput<TextModel>(TextModel, "LabelTextModel", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.labelTextModel, "The text model to be used for the numbers next to the tick marks on "
		                     + "each axis (x-axis, y-axis, and secondary y-axis).\n"
		                     + "Determines the font, color, and style (bold, italics) for the text.",
				["TextModelDefault"]);
		this.addInput(this.labelTextModel);

		this.graphColor = new ColourProvInput("GraphColor", Entity.KEY_INPUTS, ColourInput.getColorWithName("ivory"));
		this.setKeywordDoc(this.graphColor, "The color of the graph background.", []);
		this.addInput(this.graphColor);
		this.addSynonym(this.graphColor, "GraphColour");

		this.backgroundColor = new ColourProvInput("BackgroundColor", Entity.KEY_INPUTS, ColourInput.getColorWithName("gray95"));
		this.setKeywordDoc(this.backgroundColor, "The color for the outer pane background.", []);
		this.addInput(this.backgroundColor);
		this.addSynonym(this.backgroundColor, "BackgroundColour");

		this.borderColor = new ColourProvInput("BorderColor", Entity.KEY_INPUTS, ColourInput.BLACK);
		this.setKeywordDoc(this.borderColor, "The color of the graph border.", []);
		this.addInput(this.borderColor);
		this.addSynonym(this.borderColor, "BorderColour");
	}

	/** 描画: 省略（three.js の画面を作るときに）。Java は new Binding(ent, this) */
	override getBinding(ent: Entity): object | null {
		return null;
	}

	override canDisplayEntity(ent: Entity): boolean {
		return LateClasses.isInstance(ent, "com.jaamsim.Graphics.AbstractGraph");
	}

}

ClassRegistry.register("com.jaamsim.DisplayModels.GraphModel", GraphModel);
LateClasses.bind("com.jaamsim.DisplayModels.GraphModel", GraphModel);
