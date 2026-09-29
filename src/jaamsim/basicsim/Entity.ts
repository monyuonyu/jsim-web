import { EntityLabel } from "../Graphics/EntityLabel.ts";
import { AttributeDefinitionListInput } from "../input/AttributeDefinitionListInput.ts";
import { AttributeHandle } from "../input/AttributeHandle.ts";
import { BooleanInput } from "../input/BooleanInput.ts";
import { EntityNameInput } from "../input/EntityNameInput.ts";
import { ExpError } from "../input/ExpError.ts";
import { ExpEvaluator } from "../input/ExpEvaluator.ts";
import { ExpResType } from "../input/ExpResType.ts";
import { ExpResult } from "../input/ExpResult.ts";
import { ExpValResult } from "../input/ExpValResult.ts";
import { ExpressionHandle } from "../input/ExpressionHandle.ts";
import { InOutHandle } from "../input/InOutHandle.ts";
import type { Input } from "../input/Input.ts";
import { InputAgent } from "../input/InputAgent.ts";
import { InputCallback } from "../input/InputCallback.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import type { NamedExpression } from "../input/NamedExpression.ts";
import { NamedExpressionListInput } from "../input/NamedExpressionListInput.ts";
import { OutputHandle } from "../input/OutputHandle.ts";
import { ParentEntityInput } from "../input/ParentEntityInput.ts";
import { ParseContext } from "../input/ParseContext.ts";
import { StringInput } from "../input/StringInput.ts";
import { SynonymInput } from "../input/SynonymInput.ts";
import type { ValueHandle } from "../input/ValueHandle.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { tr } from "../i18n/I18n.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { jformat, jIsAssignableFrom, jRemove } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import type { Unit } from "../units/Unit.ts";
import type { EntityListNode } from "./EntityListNode.ts";
import { ErrorException } from "./ErrorException.ts";
import { JaamSimModel } from "./JaamSimModel.ts";
import { JFile } from "./FileEntity.ts";
import { Log } from "./Log.ts";
import type { ObjectType } from "./ObjectType.ts";
import type { Simulation } from "./Simulation.ts";

/** @Keyword の注釈の代わり（setKeywordDoc で入力に持たせる説明と例） */
export interface KeywordDoc {
	description: string;
	exampleList: string[];
}

const keywordDocs = new WeakMap<object, KeywordDoc>();

/**
 * Abstract class that encapsulates the methods and data needed to create a
 * simulation object. Encapsulates the basic system objects to achieve discrete
 * event execution.
 *
 * 移植の注意:
 * - Java の初期化ブロック（入力を作る所）は、コンストラクタの始めに同じ順で書いた。
 * - Java でパッケージの中だけから使うもの（entityName, listNode, parent, prototype, setFlag など）は public にした。
 * - 多重定義: copyInputs(ent[, seq[, context]])・setTraceFlag([bool]) は引数の数で見分ける。
 *   出力の getChildren(simTime)・getPrototype(simTime)・getCloneList(simTime) は、
 *   getChildrenOutput・getPrototypeOutput・getCloneListOutput に名前を変えた（renamed.md）。
 * - @Keyword は setKeywordDoc(input, 説明, 例) で、入力ごとに説明を持たせる（Entity.getKeywordDoc で引く）。
 */
export class Entity {
	private readonly simModel: JaamSimModel;

	entityName: string | null = null;
	private readonly entityNumber: number;

	// Package private so it can be accessed by JaamSimModel and EntityListNode
	listNode: EntityListNode | null = null;

	private static readonly FLAG_TRACE = 0x01;
	//public static final int FLAG_TRACEREQUIRED = 0x02;
	//public static final int FLAG_TRACESTATE = 0x04;
	//public static final int FLAG_LOCKED = 0x08;
	//public static final int FLAG_TRACKEVENTS = 0x10;
	static readonly FLAG_ADDED = 0x20;  // entity was defined after the 'RecordEdits' flag
	static readonly FLAG_EDITED = 0x40;  // one or more inputs were modified after the 'RecordEdits' flag
	static readonly FLAG_GENERATED = 0x80;  // entity was created during the execution of the simulation
	static readonly FLAG_DEAD = 0x0100;  // entity has been deleted
	static readonly FLAG_REGISTERED = 0x0200;  // entity is included in the namedEntities HashMap
	static readonly FLAG_RETAINED = 0x0400;  // entity is retained when the model is reset between runs
	static readonly FLAG_POOLED = 0x0800;  // entity is held in its prototype's clone pool
	private flags: number;

	parent: Entity | null = null;

	prototype: Entity | null = null;
	cloneList: Entity[] | null = null;  // all registered, unregistered, and pooled clones
	clonePool: Entity[] | null = null;  // generated clones available for re-use
	private static readonly MAX_POOL = 100;

	private readonly inpList: Input<unknown>[] = [];

	private userOutputMap: Map<string, ValueHandle> | null = null;

	// Input categories
	public static readonly KEY_INPUTS = "Key Inputs";
	public static readonly OPTIONS = "Options";
	public static readonly GRAPHICS = "Graphics";
	public static readonly THRESHOLDS = "Thresholds";
	public static readonly MAINTENANCE = "Maintenance";
	public static readonly FONT = "Font";
	public static readonly FORMAT = "Format";
	public static readonly GUI = "GUI";
	public static readonly MULTIPLE_RUNS = "Multiple Runs";

	// Future event insertion rules
	public static readonly EVT_FIFO = true;
	public static readonly EVT_LIFO = false;

	// Future event priorities
	public static readonly PRI_HIGHEST = 0;
	public static readonly PRI_HIGHER = 1;
	public static readonly PRI_HIGH = 2;
	public static readonly PRI_NORMAL = 5;
	public static readonly PRI_MED_LOW = 7;
	public static readonly PRI_LOW = 10;
	public static readonly PRI_LOWER = 11;
	public static readonly PRI_LOWEST = 99;

	protected readonly nameInput: EntityNameInput;

	protected readonly parentInput: ParentEntityInput;

	protected readonly desc: StringInput;

	protected readonly trace_: BooleanInput;  // Java の trace（関数 trace と名前がぶつかるので trace_ にした）

	protected readonly active: BooleanInput;

	public readonly attributeDefinitionList: AttributeDefinitionListInput;

	public readonly namedExpressionInput: NamedExpressionListInput;

	/**
	 * Constructor for entity initializing members.
	 */
	constructor() {
		// ---- Java の初期化ブロック ----
		this.nameInput = new EntityNameInput("Name", Entity.KEY_INPUTS, "");
		this.setKeywordDoc(this.nameInput, "Local name for the entity.",
				["Conveyor1"]);
		this.nameInput.setCallback(Entity.nameInputCallback);
		this.nameInput.setOutput(false);
		this.addInput(this.nameInput);

		this.parentInput = new ParentEntityInput("Parent", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.parentInput, "Parent entity for this entity.",
				["SimEntity1"]);
		this.parentInput.setCallback(Entity.parentInputCallback);
		this.parentInput.setOutput(false);
		this.addInput(this.parentInput);

		this.desc = new StringInput("Description", Entity.KEY_INPUTS, "");
		this.setKeywordDoc(this.desc, "A free-form string describing the object.",
				["'A very useful entity'"]);
		this.addInput(this.desc);

		this.trace_ = new BooleanInput("Trace", Entity.OPTIONS, false);
		this.setKeywordDoc(this.trace_, "Provides the programmer with a detailed trace of the logic executed "
				+ "by the entity. Trace information is sent to standard out.", []);
		this.trace_.setCallback(Entity.traceInputCallback);
		this.trace_.setHidden(true);
		this.addInput(this.trace_);

		this.active = new BooleanInput("Active", Entity.OPTIONS, true);
		this.setKeywordDoc(this.active, "If TRUE, the object is used in the simulation run.", []);
		this.active.setHidden(true);
		this.addInput(this.active);

		this.attributeDefinitionList = new AttributeDefinitionListInput("AttributeDefinitionList",
				Entity.OPTIONS, [] as NamedExpression[]);
		this.setKeywordDoc(this.attributeDefinitionList, "Defines one or more attributes for this entity. "
				+ "An attribute's value can be a number with or without units, "
				+ "an entity, a string, an array, a hashmap, or a lambda function. "
				+ "The initial value set by the definition can only be changed by an "
				+ "Assign object.", []);
		this.attributeDefinitionList.setCallback(Entity.userOutputCallback);
		this.attributeDefinitionList.setHidden(false);
		this.addInput(this.attributeDefinitionList);

		this.namedExpressionInput = new NamedExpressionListInput("CustomOutputList",
				Entity.OPTIONS, [] as NamedExpression[]);
		this.setKeywordDoc(this.namedExpressionInput, "Defines one or more custom outputs for this entity. "
				+ "A custom output can return a number with or without units, "
				+ "an entity, a string, an array, a map, or a lambda function. "
				+ "The present value of a custom output is calculated on demand by the "
				+ "model.",
				["{ TwiceSimTime '2*this.SimTime' TimeUnit }  { SimTimeInDays 'this.SimTime/1[d]' }",
				 "{ FirstEnt 'size([Queue1].QueueList)>0 ? [Queue1].QueueList(1) : [SimEntity1]' }"]);
		this.namedExpressionInput.setCallback(Entity.userOutputCallback);
		this.namedExpressionInput.setHidden(false);
		this.addInput(this.namedExpressionInput);

		// ---- Java のコンストラクタ ----
		this.simModel = JaamSimModel.getCreateModel()!;
		this.entityNumber = this.simModel.getNextEntityID();
		this.flags = 0;
	}

	// ---- @Keyword の代わり ----

	/**
	 * 入力に、キーワードの説明と例を持たせる（Java の @Keyword(description, exampleList) の代わり）。
	 * 説明の文は英語のまま渡す（表示するときに辞書で引く）。
	 */
	setKeywordDoc(input: Input<unknown>, description: string, exampleList: string[]): void {
		keywordDocs.set(input, { description, exampleList });
	}

	/** setKeywordDoc で持たせた説明と例（無ければ null） */
	static getKeywordDoc(input: Input<unknown>): KeywordDoc | null {
		const inp = input as unknown as { isSynonym?: () => boolean; input?: Input<unknown> };
		let doc = keywordDocs.get(input);
		if (doc === undefined && inp.isSynonym?.() && inp.input !== undefined)
			doc = keywordDocs.get(inp.input);
		return doc ?? null;
	}

	static readonly nameInputCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, inp: Input<unknown>): void {
			const newName = inp.getValue() as string;
			if (newName.length === 0 || newName === ent.entityName)
				return;
			const label = EntityLabel.getLabel(ent);
			ent.setLocalName(newName);

			// Update the entity's label
			if (label != null) {
				if (label.getParent() !== ent)
					label.setLocalName(newName + "_Label");
				label.updateForTargetNameChange();
			}
		}
	})();

	setNameInput(localName: string): void {
		if (this.nameInput.isDef()) {
			this.nameInput.setInitialValue(localName);
			this.setLocalName(localName);
			this.nameInput.setLocked(this.isGenerated());
			return;
		}
		InputAgent.applyArgs(this, this.nameInput.getKeyword(), localName);
	}

	resetNameInput(): void {
		this.nameInput.reset();
		this.setLocalName(this.nameInput.getValue() as string);
	}

	static readonly parentInputCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, inp: Input<unknown>): void {
			const newParent = inp.getValue() as Entity | null;
			if (newParent === ent.parent)
				return;
			const simModel = ent.getJaamSimModel();
			simModel.removeNamedEntity(ent);
			ent.parent = newParent;
			simModel.addNamedEntity(ent);
		}
	})();

	setParentInput(newParent: Entity | null): void {
		if (this.parentInput.isDef()) {
			this.parentInput.setInitialValue(newParent);
			this.parent = newParent;
			this.parentInput.setLocked(this.isGenerated());
			return;
		}
		InputAgent.applyArgs(this, this.parentInput.getKeyword(), newParent!.getName());
	}

	isCopyOf(ent: Entity): boolean {

		// Names and classes must match
		if (ent.constructor !== this.constructor || ent.getName() !== this.getName()) {
			console.log(jformat("Names or classes do not match: this=%s, ent=%s", String(this), String(ent)));
			return false;
		}

		// Input strings must match
		let ret = true;
		for (let i = 0; i < this.inpList.length; i++) {
			const inp = this.inpList[i];
			if (inp.isSynonym() || inp === this.nameInput || inp === this.parentInput)
				continue;
			if (InputAgent.isGraphicsInput(inp))  //FIXME resetGraphics clears the Position/Points inputs
				continue;
			const in1 = ent.inpList[i];
			if (!stringListEquals(inp.getValueTokens(), in1.getValueTokens())) {
				console.log(jformat("Inputs do not match: entity=%s, keyword=%s, in0=%s, in1=%s",
						String(ent), inp.getKeyword(), inp.getValueString(), in1.getValueString()));
				ret = false;
			}
		}
		return ret;
	}

	/**
	 * Performs any initialization that must occur after the constructor has finished.
	 */
	postDefine(): void {

		// Add any specified inputs as outputs
		this.updateUserOutputMap();

		// Create any children for the new entity
		if (this.prototype != null) {
			const reg = this.isRegistered();
			const retain = this.isRetained();
			for (const child of this.prototype.getChildren()) {
				const name = child.getLocalName()!;
				const klass = child.constructor as JClass<Entity>;
				InputAgent.generateEntityWithName(this.simModel, klass, child, name, this, reg, retain);
			}

			// Copy the inputs for the new components
			for (let seq = 0; seq < 2; seq++) {
				for (const child of this.getChildren()) {
					child.copyInputs(child.prototype!, seq);
				}
			}
		}
	}

	getJaamSimModel(): JaamSimModel {
		return this.simModel;
	}

	getSimulation(): Simulation {
		return this.simModel.getSimulation()!;
	}

	/**
	 * Performs any additional actions that are required after a new configuration file has been
	 * loaded. Performed prior to validation.
	 */
	postLoad(): void {}

	validate(): void {
		for (const inp of this.inpList) {
			try {
				inp.validate();
			}
			catch (e) {
				if (!(e instanceof ErrorException)) throw e;
				e.entName = this.getName();
				e.keyword = inp.getKeyword();
				throw e;
			}
		}

		if (!this.isActive() && this.active.getHidden() && !this.active.isDef())
			throw new ErrorException(
					"Setting the Active keyword to FALSE has no effect on this object");
	}

	/**
	 * Initialises the entity prior to the start of the model run.
	 * <p>
	 * This method must not depend on any other entities so that it can be
	 * called for each entity in any sequence.
	 */
	earlyInit(): void {

		// Reset the attributes to their initial values
		for (const vh of this.getAllUserOutputHandles()) {
			if (!(vh instanceof AttributeHandle))
				continue;
			const h = vh;
			try {
				const res = ExpEvaluator.evaluateExpression(h.getExpression(), this, 0.0);
				h.setValue(res);
			}
			catch (e) {
				if (!(e instanceof ExpError)) throw e;
				throw new ErrorException(this, this.attributeDefinitionList.getKeyword(), e);
			}
		}

		// Clear the clone pool
		this.clonePool = null;
	}

	/**
	 * Initialises the entity prior to the start of the model run.
	 * <p>
	 * This method assumes other entities have already called earlyInit.
	 */
	lateInit(): void {}

	/**
	 * Starts the execution of the model run for this entity.
	 * <p>
	 * If required, initialisation that depends on another entity can be
	 * performed in this method. It is called after earlyInit().
	 */
	startUp(): void {}

	/**
	 * Resets the statistics collected by the entity.
	 */
	clearStatistics(): void {}

	/**
	 * Assigns input values that are helpful when the entity is dragged and
	 * dropped into a model.
	 */
	setInputsForDragAndDrop(): void {}

	kill(): void {
		//System.out.format("%s.kill%n", this);

		// Remove the entity from the model
		if (!this.isDead()) {
			this.simModel.removeInstance(this);
			this.setFlag(Entity.FLAG_DEAD);
		}

		// Kill the entity's clones
		for (const clone of this.getCloneList()) {
			clone.kill();
		}

		// Clear the pool of generated clones
		this.clonePool = null;

		// If the entity is a clone, remove it from its prototype's list
		if (this.prototype != null)
			this.prototype.removeClone(this);

		// Kill the entity's children
		for (const ent of this.getChildren()) {
			ent.kill();
		}
	}

	/**
	 * Reverses the actions taken by the kill method.
	 */
	restore(): void {
		//System.out.format("%s.restore%n", this);

		// Restore the children before the parent entity
		for (const ent of this.getChildren()) {
			ent.restore();
		}

		// Restore the clones before the parent entity
		for (const clone of this.getCloneList()) {
			clone.restore();
		}

		// Restore the entity to the model
		this.simModel.restoreInstance(this);
		this.clearFlag(Entity.FLAG_DEAD);

		if (this.prototype != null)
			this.prototype.addClone(this);
	}

	/**
	 * Returns whether the entity was defined after the 'RecordEdits' flag was set.
	 * @return true if defined after RecordEdits
	 */
	isAdded(): boolean {
		return this.testFlag(Entity.FLAG_ADDED);
	}

	/**
	 * Returns whether the entity was created during the execution of the simulation run.
	 * @return true if created during the simulation run
	 */
	isGenerated(): boolean {
		return this.testFlag(Entity.FLAG_GENERATED);
	}

	/**
	 * Returns whether the entity is included in the 'namedEntities' HashMap and therefore can be
	 * referenced by the inputs to other entities.
	 * @return true if its name is recorded
	 */
	isRegistered(): boolean {
		return this.testFlag(Entity.FLAG_REGISTERED);
	}

	/**
	 * Returns whether the generated entity is retained at the end of a simulation run for re-use
	 * in the next run.
	 * @return true if the entity is to be retained at the end of the simulation run
	 */
	isRetained(): boolean {
		return this.testFlag(Entity.FLAG_RETAINED);
	}

	/**
	 * Returns whether all references to the entity have been removed by the 'kill' method.
	 * @return true if the entity has been killed
	 */
	isDead(): boolean {
		return this.testFlag(Entity.FLAG_DEAD);
	}

	/**
	 * Returns whether one or more inputs were modified after the 'RecordEdits' flag was set.
	 * @return true if edited after RecordEdits
	 */
	isEdited(): boolean {
		return this.testFlag(Entity.FLAG_EDITED);
	}

	setEdited(): void {
		this.setFlag(Entity.FLAG_EDITED);
	}

	/**
	 * Returns whether the entity is being held its prototype's clone pool, ready for re-use
	 * @return true if the entity is pooled for re-use
	 */
	isPooled(): boolean {
		return this.testFlag(Entity.FLAG_POOLED) || (this.parent != null && this.parent.isPooled());
	}

	/**
	 * Returns whether the entity was created by the 'autoload' file.
	 * @return true if created by autoload
	 */
	isPreDefined(): boolean {
		return this.simModel.isPreDefinedEntity(this);
	}

	/**
	 * Returns whether the entity can participate in the simulation.
	 * @return true if the entity can be used
	 */
	isActive(): boolean {
		return this.active.getValue() as boolean;
	}

	/**
	 * Performs any actions that are required at the end of the simulation run, e.g. to create an output report.
	 */
	doEnd(): void {}

	/**
	 * Performs any actions that are required when a model is closed prior to its scheduled end
	 * time. For example, an entity may need to close a file that it opened.
	 */
	close(): void {}

	protected clearInputs(): void {
		this.inpList.length = 0;
	}

	protected addInput(inp: Input<unknown>): void {
		this.inpList.push(inp);
	}

	protected removeInput(inp: Input<unknown>): void {
		jRemove(this.inpList, inp);
	}

	protected addSynonym(inp: Input<unknown>, synonym: string): void {
		this.inpList.push(new SynonymInput(synonym, inp) as unknown as Input<unknown>);
	}

	getInput(key: string): Input<unknown> | null {
		for (let i = 0; i < this.inpList.length; i++) {
			const inp = this.inpList[i];
			if (key === inp.getKeyword()) {
				if (inp.isSynonym())
					return (inp as unknown as SynonymInput).input as Input<unknown>;
				else
					return inp;
			}
		}

		return null;
	}

	/**
	 * Copy the inputs for each keyword to the caller.
	 * copyInputs(ent)、copyInputs(ent, seq)、copyInputs(ent, seq, context) の 3 つを引数の数で見分ける。
	 * @param ent = entity whose inputs are to be copied
	 * @param seq = sequence number for the keyword (0 = early keyword, 1 = normal keyword)
	 */
	copyInputs(ent: Entity, seq?: number, context?: ParseContext | null): void {
		// copyInputs(Entity ent)
		if (seq === undefined) {
			let ctx: ParseContext | null = null;
			const configFile = this.simModel.getConfigFile();
			if (configFile != null) {
				const uri = JFile.toURI(JFile.getParent(configFile), true);
				ctx = new ParseContext(uri, null);
			}
			for (let s = 0; s < 2; s++) {
				this.copyInputs(ent, s, ctx);
			}
			return;
		}

		// copyInputs(Entity ent, int seq)
		if (context === undefined) {
			let ctx: ParseContext | null = null;
			const configFile = this.simModel.getConfigFile();
			if (configFile != null) {
				const uri = JFile.toURI(JFile.getParent(configFile), true);
				ctx = new ParseContext(uri, null);
			}
			this.copyInputs(ent, seq, ctx);
			return;
		}

		// copyInputs(Entity ent, int seq, ParseContext context)

		// Provide stub definitions for the custom outputs
		if (seq === 0) {
			for (const inp of ent.getEditableInputs()) {
				const stub = inp.getStubDefinition();
				if (stub == null || inp.isDef())
					continue;
				const kw = KeywordIndex.formatInput(inp.getKeyword(), stub);
				InputAgent.apply(this, kw);
			}
		}

		// Apply the inputs based on the source entity
		for (const sourceInput of ent.getEditableInputs()) {
			if (sourceInput.isSynonym() || sourceInput.getSequenceNumber() !== seq
					|| sourceInput instanceof EntityNameInput
					|| sourceInput instanceof ParentEntityInput)
				continue;
			const key = sourceInput.getKeyword();
			try {
				this.copyInput(ent, key, context);
			}
			catch (t) {
				Log.logException(t);
			}
		}
	}

	/**
	 * Copy the input with the specified keyword from the specified entity to the caller.
	 * @param ent - entity whose input is to be copied
	 * @param key - keyword for the input to be copied
	 * @param context - specifies the file path to the folder containing the configuration file
	 * @param ignoreDef - true if a default input is not copied
	 */
	copyInput(ent: Entity, key: string, context: ParseContext | null): void {
		//boolean trace = ent.getLocalName().equals("Label") && key.equals("Name");
		//if (trace) System.out.format("%n%s.copyInput - ent=%s, key=%s%n", this, ent, key);

		const sourceInput = ent.getInput(key);
		const targetInput = this.getInput(key);
		if (sourceInput == null || targetInput == null)
			return;

		// Replace references to the parent entity
		const tmp = ent.getValueTokens(sourceInput, this.parent);

		// An overwritten input for a clone cannot be changed by the prototype, except in the
		// following circumstances:
		// - the input was inherited from its prototype but contained an explicit reference to its
		//   parent entity
		// - the new input value from the prototype is equal to the present value (handled in the
		//   'assign' method)
		// - the input is for the CustomOutputList keyword which had been assigned a stub value
		if (this.getPrototype() === ent && !targetInput.isDef() && !targetInput.isInherited()
				&& !stringListEquals(targetInput.getValueTokens(), tmp)
				&& targetInput.getStubDefinition() == null)
			return;

		// Set the new input value
		try {
			const kw = new KeywordIndex(key, tmp, context);
			InputAgent.apply(this, targetInput, kw);
		}
		catch (e) {
			// Java は Exception だけを受ける（Error は受けない）
			throw new ErrorException(this, key, e);
		}
	}

	/**
	 * Returns the array of input tokens for the specified input with any explicit references to
	 * this entity's parent entity replaced with the specified parent entity.
	 * @param in - input object
	 * @param newParent - specified parent entity
	 * @return input tokens
	 */
	getValueTokens(inp: Input<unknown>, newParent: Entity | null): string[] {

		// For a blank input, check the input inherited from its prototype and replace references
		// to the prototype's parent
		if (inp.isDef() && this.prototype != null && inp.getProtoInput() != null)
			return this.prototype.getValueTokens(inp.getProtoInput()!, newParent);

		const ret = inp.getValueTokens();
		if (ret.length === 0 || this.parent == null || newParent == null || this.parent === newParent)
			return ret;

		// Find the first parent that has a different name
		let oldP: Entity = this.parent;
		let newP: Entity = newParent;
		while (oldP.getLocalName() === newP.getLocalName()
				&& oldP.parent != null && newP.parent != null) {
			oldP = oldP.parent;
			newP = newP.parent;
		}

		// Replace any explicit references to the parent entity with the specified new parent
		const oldName = this.parent.getName();
		const oldName1 = "[" + oldName + "]";
		const oldName2 = oldP.getName() + ".";

		const newName = newParent.getName();
		const newName1 = "[" + newName + "]";
		const newName2 = newP.getName() + ".";

		for (let i = 0; i < ret.length; i++) {
			let str = ret[i];
			if (str === oldName)
				str = newName;
			else {
				str = str.split(oldName1).join(newName1);  // Java の String.replace（全部を置き換える）
				str = str.split(oldName2).join(newName2);
			}
			ret[i] = str;
		}
		return ret;
	}

	getInheritedValueTokens(inp: Input<unknown>): string[] {
		if (this.prototype == null || inp.getProtoInput() == null)
			return [];
		return this.prototype.getValueTokens(inp.getProtoInput()!, this.parent);
	}

	/**
	 * Copies the present attribute values from one entity to another.
	 * @param ent - entity whose attribute values are to be copied
	 * @param target - entity whose attribute values are to be assigned
	 */
	static copyAttributeValues(ent: Entity, target: Entity): void {
		for (const sourceVHandle of ent.getAllUserOutputHandles()) {
			const targetVHandle = target.getUserOutputHandle(sourceVHandle.getName());
			if (!(sourceVHandle instanceof AttributeHandle)
					|| !(targetVHandle instanceof AttributeHandle))
				continue;
			const sourceHandle = sourceVHandle;
			const targetHandle = targetVHandle;
			targetHandle.setValue(sourceHandle.copyValue());
		}
	}

	getEntityReferences(): Entity[] {
		const ret: Entity[] = [];
		for (const inp of this.inpList) {
			inp.appendEntityReferences(ret);
		}
		return ret;
	}

	/**
	 * Returns a list of entities that are appear in the inputs to this entity and its children,
	 * grand-children, etc., but are not the entity or one of its children, grand-children, etc.
	 * or one of the entities that is defined automatically when JaamSim is launched.
	 * @return list of entities that are external references
	 */
	getExternalReferences(): Entity[] {
		const ret: Entity[] = [];
		const entityList: Entity[] = [...this.getDescendants()];
		entityList.unshift(this);
		for (const ent of entityList) {
			for (const reference of ent.getEntityReferences()) {
				if (reference.isPreDefined() || entityList.includes(reference)
						|| ret.includes(reference))
					continue;
				ret.push(reference);
			}
		}
		return ret;
	}

	setFlag(flag: number): void {
		this.flags |= flag;
	}

	clearFlag(flag: number): void {
		this.flags &= ~flag;
	}

	testFlag(flag: number): boolean {
		return (this.flags & flag) !== 0;
	}

	/** setTraceFlag() と setTraceFlag(bool) を 1 つにした（引数なしは true と同じ） */
	setTraceFlag(bool?: boolean): void {
		if (bool === undefined || bool)
			this.setFlag(Entity.FLAG_TRACE);
		else
			this.clearFlag(Entity.FLAG_TRACE);
	}

	clearTraceFlag(): void {
		this.clearFlag(Entity.FLAG_TRACE);
	}

	isTraceFlag(): boolean {
		return this.testFlag(Entity.FLAG_TRACE);
	}

	/**
	 * Method to return the name of the entity.
	 * This returns the "absolute" name for entities that are the child of other entities.
	 * Use getLocalName() for the name relative to this entity's parent
	 */
	getName(): string {
		if (this.parent == null) {
			return String(this.entityName);
		}
		return this.parent.getName() + "." + this.entityName;
	}

	getLocalName(): string | null {
		return this.entityName;
	}

	/**
	 * Add a child to this entity, should only be called from JaamSimModel
	 * @param child
	 */
	addChild(_child: Entity): void {
		this.error("Entity [%s] may not have children", this.getName());
	}

	removeChild(_child: Entity): void {
		this.error("Entity [%s] may not have children", this.getName());
	}

	/**
	 * Get the unique number for this entity
	 */
	getEntityNumber(): number {
		return this.entityNumber;
	}

	/**
	 * Method to return the unique identifier of the entity. Used when building Edit tree labels
	 * @return entityName
	 */
	toString(): string {
		return this.getName();
	}

	/**
	 * Sets the local name of the entity.
	 * @param newName - new local name
	 */
	setLocalName(newName: string): void {
		this.simModel.renameEntity(this, newName);
	}

	/**
	 * Returns the parent entity for this entity
	 */
	getParent(): Entity | null {
		return this.parent;
	}

	/**
	 * Gets a named child from this entity.
	 * Default behaviour always returns null, only specific entities may have children
	 * @param name - the local name of the child, implementers must split the name on '.' characters and recursively call getChild()
	 * @return the descendant named or null if no such entity exists
	 */
	getChild(_name: string): Entity | null {
		return null;
	}

	/**
	 * Returns the named child entities for this entity.
	 * @return array of child entities
	 */
	getChildren(): Entity[] {
		return [];
	}

	/**
	 * Returns a list of all the children, grand-children, etc. of this entity.
	 * @return array of descendant entities
	 */
	getDescendants(): Entity[] {
		const ret: Entity[] = [];
		for (const ent of this.getChildren()) {
			ret.push(ent);
			ret.push(...ent.getDescendants());
		}
		return ret;
	}

	getSubModelLevel(): number {
		if (this.parent == null)
			return 0;
		return this.parent.getSubModelLevel() + 1;
	}

	/**
	 * Returns the number of entities that must be defined before this entity can be defined.
	 * @return number of entities that must be defined previously
	 */
	getDependenceLevel(): number {
		if (this.parent == null && this.prototype == null && !this.hasClone())
			return 0;
		return this.getDependencies().length;
	}

	/**
	 * Returns a list of entities that must be defined before this entity can be defined.
	 * @return list of entities to be defined previously
	 */
	private getDependencies(): Entity[] {
		const ret: Entity[] = [];
		this.addDependencies(ret);
		return ret;
	}

	private addDependencies(list: Entity[]): void {

		// Add the parent entity and its dependencies
		if (this.parent != null && !list.includes(this.parent)) {
			list.push(this.parent);
			this.parent.addDependencies(list);
		}

		// Add the prototype entity and its dependencies
		if (this.prototype != null && !list.includes(this.prototype)) {
			list.push(this.prototype);
			this.prototype.addDependencies(list);

			// Any children of the prototype must also be defined previously
			for (const ent of this.prototype.getChildren()) {
				if (!ent.isGenerated() && !list.includes(ent)) {
					list.push(ent);
					ent.addDependencies(list);
				}
			}
		}
	}

	static readonly traceInputCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, inp: Input<unknown>): void {
			const trc = inp as unknown as BooleanInput;
			ent.setTraceFlag((trc.getValue() as boolean) && ent.isEnableTracing());
		}
	})();

	isEnableTracing(): boolean {
		return this.getSimulation() != null && this.getSimulation().isEnableTracing();
	}

	enableTracing(bool: boolean): void {
		this.trace_.setHidden(!bool);
		this.setTraceFlag(bool && (this.trace_.getValue() as boolean));
	}

	static readonly userOutputCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, _inp: Input<unknown>): void {
			ent.updateUserOutputMap();
		}
	})();

	updateUserOutputMap(): void {
		this.clearUserOutputs();
		for (const ne of this.attributeDefinitionList.getValue() as NamedExpression[]) {
			const ah = new AttributeHandle(this, ne.getName(), ne.getExpression(), null, ne.getUnitType());
			this.addUserOutputHandle(ne.getName(), ah);
		}
		for (const ne of this.namedExpressionInput.getValue() as NamedExpression[]) {
			const eh = new ExpressionHandle(this, ne.getExpression(), ne.getName(), ne.getUnitType());
			this.addUserOutputHandle(eh.getName(), eh);
		}
		for (const inp of this.inpList) {
			if (!inp.isOutput() || inp.getHidden())
				continue;
			const ioh = new InOutHandle(this, inp, inp.getKeyword(), inp.getReturnType(), inp.getUnitType());
			this.addUserOutputHandle(ioh.getName(), ioh);
		}
	}

	handleSelectionLost(): void {}

	// ******************************************************************************************************
	// EDIT TABLE METHODS
	// ******************************************************************************************************

	getEditableInputs(): Input<unknown>[] {
		return this.inpList;
	}

	// ******************************************************************************************************
	// TRACING METHODS
	// ******************************************************************************************************

	/**
	 * Prints a trace statement for the given subroutine.
	 * The entity name is included in the output.
	 * @param indent - number of tabs with which to indent the text
	 * @param fmt - format string for the trace data (include the method name)
	 * @param args - trace data
	 */
	trace(indent: number, fmt: string, ...args: unknown[]): void {
		this.simModel.trace(indent, this, fmt, ...args);
	}

	/**
	 * Prints an additional line of trace info.
	 * The entity name is NOT included in the output
	 * @param indent - number of tabs with which to indent the text
	 * @param fmt - format string for the trace data
	 * @param args - trace data
	 */
	traceLine(indent: number, fmt: string, ...args: unknown[]): void {
		this.simModel.trace(indent, null, fmt, ...args);
	}

	/**
	 * Throws an ErrorException for this entity with the specified message.
	 * 書式は中で tr してから埋める（呼ぶ側で tr を付けても害は無い）。
	 * double を %s で渡すときは、呼ぶ側で jstr にしておく。
	 * @param fmt - format string for the error message
	 * @param args - objects used by the format string
	 * @throws ErrorException
	 */
	error(fmt: string | null, ...args: unknown[]): never {
		if (fmt == null)
			throw new ErrorException(this, "null");

		throw new ErrorException(this, jformat(tr(fmt), ...args));
	}

	/**
	 * Returns a user specific unit type. This is needed for entity types like distributions that may change the unit type
	 * that is returned at runtime.
	 */
	getUserUnitType(): JClass<Unit> {
		return DimensionlessUnit;
	}

	getOutputHandle(outputName: string): ValueHandle | null {
		const ret = this.getUserOutputHandle(outputName);
		if (ret != null)
			return ret;

		return OutputHandle.getOutputHandle(this, outputName);
	}

	/**
	 * Returns true if there are any outputs that will be printed to the output report.
	 */
	isReportable(): boolean {
		return OutputHandle.isReportable(this.constructor as JClass<Entity>);
	}

	getDescription(): string {
		return this.desc.getValue() as string;
	}

	private addUserOutputHandle(name: string, vh: ValueHandle): void {
		if (this.userOutputMap == null)
			this.userOutputMap = new Map<string, ValueHandle>();
		this.userOutputMap.set(name, vh);
	}

	private getUserOutputHandle(name: string): ValueHandle | null {
		if (this.userOutputMap == null)
			return null;
		return this.userOutputMap.get(name) ?? null;
	}

	private getAllUserOutputHandles(): ValueHandle[] {
		if (this.userOutputMap == null)
			return [];
		return [...this.userOutputMap.values()];
	}

	private clearUserOutputs(): void {
		this.userOutputMap = null;
	}

	// Utility function to help set attribute values for nested indices
	private setAttribIndices(coll: ExpResult.Collection, indices: ExpResult[], indNum: number, value: ExpResult): ExpResult {
		console.assert(indNum < indices.length);
		const indType = indices[indNum].type;
		if (indType !== ExpResType.NUMBER && indType !== ExpResType.STRING) {
			this.error("Assigning to attributes must have numeric or string indices. Index #%d is %s",
			           indNum, ExpValResult.typeString(indices[indNum].type));
		}
		if (indNum === indices.length-1) {
			// Last index, assign the value
			const newCol = coll.assign(indices[indNum], value.getCopy());
			return ExpResult.makeCollectionResult(newCol);
		}
		// Otherwise, recurse one level deeper
		const nestedColl = coll.index(indices[indNum]);
		if (nestedColl.type !== ExpResType.COLLECTION)
		{
			this.error("Assigning to value that is not a collection. Value is a %s", ExpValResult.typeString(nestedColl.type));
		}
		const recurseRes = this.setAttribIndices(nestedColl.colVal!, indices, indNum+1, value);
		const newCol = coll.assign(indices[indNum], recurseRes);
		return ExpResult.makeCollectionResult(newCol);
	}

	setAttribute(name: string, indices: ExpResult[] | null, value: ExpResult): void {
		const vh = this.getUserOutputHandle(name);
		if (!(vh instanceof AttributeHandle))
			throw new ExpError(null, -1, tr("Invalid attribute name for %s: %s"), String(this), name);
		const h = vh;

		let assignValue: ExpResult | null = null;

		// Collection Attribute
		if (indices != null) {
			const attribValue = h.getValue(ExpResult) as ExpResult;
			if (attribValue.type !== ExpResType.COLLECTION) {
				throw new ExpError(null, -1, tr("Trying to set %s attribute: %s with an index, "
						+ "but it is not a collection"), String(this), name);
			}

			try {
				assignValue = this.setAttribIndices(attribValue.colVal!, indices, 0, value);

			} catch (err) {
				if (!(err instanceof ExpError)) throw err;
				throw new ExpError(err.source, err.pos, tr("Error during assignment to %s: %s"),
						String(this), err.getMessage());
			}
		}

		// Single-Valued Attribute
		else {
			if (value.type === ExpResType.NUMBER && h.getUnitType() !== value.unitType) {
				throw new ExpError(null, -1, tr("Unit returned by the expression does not match the "
						+ "attribute. Received: %s, expected: %s"),
						ClassRegistry.simpleName(value.unitType!), ClassRegistry.simpleName(h.getUnitType()!));
			}
			assignValue = value.getCopy();
		}

		h.setValue(assignValue);
	}

	getAllOutputs(): ValueHandle[] {
		const ret: ValueHandle[] = OutputHandle.getAllOutputHandles(this);

		// Add the attributes and custom outputs
		ret.push(...this.getAllUserOutputHandles());

		ret.sort(Entity.valueHandleComparator);
		return ret;
	}

	// Java の private static class ValueHandleComparator（比べる関数にした）
	private static valueHandleComparator(hand0: ValueHandle, hand1: ValueHandle): number {
		const class0 = hand0.getDeclaringClass();
		const class1 = hand1.getDeclaringClass();

		if (class0 === class1) {
			if (hand0.getSequence() === hand1.getSequence())
				return 0;
			else if (hand0.getSequence() < hand1.getSequence())
				return -1;
			else
				return 1;
		}

		if (jIsAssignableFrom(class0, class1))
			return -1;
		else
			return 1;
	}

	setPrototype(proto: Entity | null): void {
		if (proto === this.prototype)
			return;
		if (this.prototype != null)
			throw new ErrorException("Cannot re-assign the prototype for an entity: "
					+ "old=%s, new=%s", String(this.prototype), String(proto));
		if (proto!.constructor !== this.constructor)
			throw new ErrorException("An entity and its prototype must be instances of the same "
					+ "class");

		// Record the clone with its prototype
		this.prototype = proto;
		this.prototype!.addClone(this);

		// Loop through the inputs for this entity
		for (let i = 0; i < this.inpList.length; i++) {
			const inp = this.inpList[i];
			if (inp.getKeyword() === "Prototype")
				continue;

			// Set the prototype input
			inp.setProtoInput(this.prototype!.inpList[i]);

			// If the inherited value is used, then perform its callback
			if (!inp.isDef() || inp.isDefault())
				continue;
			inp.doCallback(this);
		}
	}

	getPrototype(): Entity | null {
		return this.prototype;
	}

	hasClone(): boolean {
		return this.cloneList != null && this.cloneList.length > 0;
	}

	isClone(): boolean {
		return this.prototype != null;
	}

	getCloneLevel(): number {
		if (this.prototype == null)
			return 0;
		return this.prototype.getCloneLevel() + 1;
	}

	private addClone(ent: Entity): void {
		// If the entity is dead, then it already has a hashmap of its clones
		if (this.isDead())
			return;

		if (this.cloneList == null)
			this.cloneList = [];
		this.cloneList.push(ent);
	}

	private removeClone(ent: Entity): boolean {
		//System.out.format("%s.removeClone(%s) - isDead=%s, cloneList=%s%n",
		//		this, ent, isDead(), cloneList);
		// If the entity is dead, then retain its hashmap of clones
		if (this.isDead())
			return false;

		if (this.cloneList == null)
			return false;
		return jRemove(this.cloneList, ent);
	}

	private getCloneList(): Entity[] {
		if (this.cloneList == null)
			return [];
		return [...this.cloneList];
	}

	getAllClones(): Entity[] {
		const ret: Entity[] = [];
		for (const ent of this.getCloneList()) {
			if (ent.isPooled())
				continue;
			ret.push(ent);
		}
		return ret;
	}

	private addCloneToPool(clone: Entity): void {
		if (this.clonePool == null)
			this.clonePool = [];
		clone.setFlag(Entity.FLAG_POOLED);
		this.clonePool.push(clone);
	}

	getClonePoolSize(): number {
		if (this.clonePool == null)
			return 0;
		return this.clonePool.length;
	}

	getCloneFromPool(): Entity | null {
		if (this.clonePool == null || this.clonePool.length === 0)
			return null;
		const ret = this.clonePool.pop()!;
		ret.clearFlag(Entity.FLAG_POOLED);
		ret.resetNameInput();

		// Reset any inputs that were changed
		if (ret.isEdited()) {
			for (const inp of ret.inpList) {
				if (inp.isDef())
					continue;
				inp.reset();
				inp.doCallback(ret);
			}
			ret.clearFlag(Entity.FLAG_EDITED);
		}

		return ret;
	}

	/**
	 * Removes a generated entity from the model by either pooling or killing it.
	 */
	dispose(): void {
		if (!this.isGenerated())
			return;
		if (this.isClone() && this.prototype!.getClonePoolSize() < Entity.MAX_POOL) {
			this.prototype!.addCloneToPool(this);
			return;
		}
		this.kill();
	}

	/**
	 * Returns the object type for this entity.
	 * Null is returned if the entity itself is an instance of ObjectType.
	 * <p>
	 * For example, if Server1 is an instance of Server, then
	 * Server1.getObjectType() returns Server, and
	 * Server.getObjectType() returns null.
	 * @return object type for the entity
	 */
	getObjectType(): ObjectType | null {
		return this.simModel.getObjectTypeForClass(this.constructor as JClass<Entity>);
	}

	getNameOutput(_simTime: number): string {
		return this.getName();
	}

	getObjectTypeName(_simTime: number): ObjectType | null {
		 return this.getObjectType();
	}

	getSimTime(simTime: number): number {
		return simTime;
	}

	getParentOutput(_simTime: number): Entity | null {
		return this.getParent();
	}

	/** Java の getChildren(double simTime)（出力 "Children"） */
	getChildrenOutput(_simTime: number): Entity[] {
		return this.getChildren();
	}

	/** Java の getPrototype(double simTime)（出力 "Prototype"） */
	getPrototypeOutput(_simTime: number): Entity | null {
		return this.getPrototype();
	}

	/** Java の getCloneList(double simTime)（出力 "CloneList"） */
	getCloneListOutput(_simTime: number): Entity[] {
		const ret = this.getAllClones();
		ret.sort(InputAgent.uiEntitySortOrder);
		return ret;
	}

}

/** Java の ArrayList<String>.equals */
function stringListEquals(a: string[], b: string[]): boolean {
	if (a.length !== b.length)
		return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i])
			return false;
	}
	return true;
}

defineOutput(Entity, {
	name: "Name",
	description: "The unique input name for this entity.",
	unitType: DimensionlessUnit,
	sequence: 0,
	returnType: "String",
	get: (e, simTime) => e.getNameOutput(simTime),
});

defineOutput(Entity, {
	name: "ObjectType",
	description: "The class of objects that this entity belongs to.",
	unitType: DimensionlessUnit,
	sequence: 1,
	returnType: "Entity",
	get: (e, simTime) => e.getObjectTypeName(simTime),
});

defineOutput(Entity, {
	name: "SimTime",
	description: "The present simulation time.",
	unitType: TimeUnit,
	sequence: 2,
	returnType: "double",
	get: (e, simTime) => e.getSimTime(simTime),
});

defineOutput(Entity, {
	name: "Parent",
	description: "The parent entity for this entity.",
	unitType: DimensionlessUnit,
	sequence: 3,
	returnType: "Entity",
	get: (e, simTime) => e.getParentOutput(simTime),
});

defineOutput(Entity, {
	name: "Children",
	description: "List of entities whose parent is this entity.",
	unitType: DimensionlessUnit,
	sequence: 4,
	returnType: "ArrayList",
	get: (e, simTime) => e.getChildrenOutput(simTime),
});

defineOutput(Entity, {
	name: "Prototype",
	description: "The entity that provides the default inputs for this entity.",
	unitType: DimensionlessUnit,
	sequence: 5,
	returnType: "Entity",
	get: (e, simTime) => e.getPrototypeOutput(simTime),
});

defineOutput(Entity, {
	name: "CloneList",
	description: "List of entities whose prototype is this entity.",
	unitType: DimensionlessUnit,
	sequence: 6,
	returnType: "ArrayList",
	get: (e, simTime) => e.getCloneListOutput(simTime),
});

ClassRegistry.register("com.jaamsim.basicsim.Entity", Entity);
