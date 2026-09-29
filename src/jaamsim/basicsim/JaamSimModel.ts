/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2016-2025 JaamSim Software Inc.
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
import type { Command } from "../Commands/Command.ts";
import { DisplayEntity } from "../Graphics/DisplayEntity.ts";
import { EntityLabel } from "../Graphics/EntityLabel.ts";
import { isRandomStreamUser } from "../ProbabilityDistributions/RandomStreamUser.ts";
import type { RandomStreamUser } from "../ProbabilityDistributions/RandomStreamUser.ts";
import { SampleExpression } from "../Samples/SampleExpression.ts";
import { StringProvExpression } from "../StringProviders/StringProvExpression.ts";
import { SubModel } from "../SubModels/SubModel.ts";
import type { ThresholdUser } from "../Thresholds/ThresholdUser.ts";
import { IntegerVector } from "../datatypes/IntegerVector.ts";
import { EventHandle } from "../events/EventHandle.ts";
import { EventManager } from "../events/EventManager.ts";
import type { EventTimeListener } from "../events/EventTimeListener.ts";
import type { EventTraceListener } from "../events/EventTraceListener.ts";
import { ProcessTarget } from "../events/ProcessTarget.ts";
import { tr } from "../i18n/I18n.ts";
import { EntityNameInput } from "../input/EntityNameInput.ts";
import { ExpError } from "../input/ExpError.ts";
import { Input } from "../input/Input.ts";
import { InputAgent } from "../input/InputAgent.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { ParentEntityInput } from "../input/ParentEntityInput.ts";
import { ParseContext } from "../input/ParseContext.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { jformat, jRemove, Long, NullPointerException } from "../java/lang.ts";
import type { JClass } from "../java/lang.ts";
import { MRG1999a } from "../rng/MRG1999a.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { Unit } from "../units/Unit.ts";
import { ClearStatisticsTarget } from "./ClearStatisticsTarget.ts";
import { ClonesOfIterable } from "./ClonesOfIterable.ts";
import { ClonesOfIterableInterface } from "./ClonesOfIterableInterface.ts";
import { EndModelTarget } from "./EndModelTarget.ts";
import { Entity } from "./Entity.ts";
import { EntityListNode } from "./EntityListNode.ts";
import { ErrorException } from "./ErrorException.ts";
import { FileEntity, FileSystem, JFile } from "./FileEntity.ts";
import type { GUIListener } from "./GUIListener.ts";
import { InitModelTarget } from "./InitModelTarget.ts";
import { InstanceIterable } from "./InstanceIterable.ts";
import { Log } from "./Log.ts";
import { ObjectType } from "./ObjectType.ts";
import { PauseModelTarget } from "./PauseModelTarget.ts";
import type { RunListener } from "./RunListener.ts";
import { Calendar, SimCalendar } from "./SimCalendar.ts";
import type { SimDate } from "./SimDate.ts";
import type { Simulation } from "./Simulation.ts";
import { StartUpTarget } from "./StartUpTarget.ts";

/**
 * 移植の注意:
 * - Java の File は、道（パス）の文字列にした（FileEntity.ts の JFile・FileSystem を使う）。
 * - コンストラクタ JaamSimModel(String name) と JaamSimModel(JaamSimModel sm, String name) は、最初の引数で見分ける。
 * - スレッドは使わない。AtomicBoolean などは普通の値にした。
 * - createInstance(klass) と createInstance(klass, proto, name, parent, added, gen, reg, retain) は引数の数で見分ける。
 * - getClonesOfIterator(proto, iface) の iface は、interface の Class の代わりに判定の関数（例: isRandomStreamUser）。
 */
export class JaamSimModel implements EventTimeListener {
	// Perform debug only entity list validation logic
	private static readonly VALIDATE_ENT_LIST = false;

	private readonly eventManager: EventManager;
	private simulation: Simulation | null = null;
	private name: string;
	private scenarioNumber = 0;    // labels each scenario when multiple scenarios are being made
	private scenarioIndexList: IntegerVector;
	private replicationNumber = 0;
	private runListener: RunListener | null = null;  // notifies the SimRun that the run has ended
	private gui: GUIListener | null = null;
	private entityCount = 0;

	private readonly namedEntities = new Map<string, Entity>();
	private readonly preferredUnit = new Map<JClass<Unit>, Unit>();

	// Note, entityList is an empty list node used to identify the end of the list
	// The first real entity is at entityList.next.ent
	private readonly entityList = new EntityListNode();
	private numLiveEnts = 0;

	private configFile: string | null = null;           // present configuration file
	private reportDir: string | null = null;         // directory for the output reports

	private batchRun = false;       // true if the run is to be terminated automatically
	private scriptMode = false;     // TRUE if script mode (command line) is specified
	private sessionEdited = false;  // TRUE if any inputs have been changed after loading a configuration file
	private recordEditsFound = false;  // TRUE if the "RecordEdits" marker is found in the configuration file
	private recordEdits = false;       // TRUE if input changes are to be marked as edited

	private logFile: FileEntity | null = null;
	private numErrors = 0;
	private numWarnings = 0;

	private lastTickForTrace = -1;
	private preDefinedEntityCount = 0;  // Number of entities after loading autoload.cfg

	private readonly objectTypes: ObjectType[] = [];
	private readonly objectTypeMap = new Map<JClass<Entity>, ObjectType>();

	private readonly calendar = new SimCalendar();
	private startMillis = 0;  // start time in milliseonds from the epoch
	private calendarUsed = false;  // records whether the calendar has been used
	private reloadReqd = false;  // indicates that the simulation must be saved and reloaded

	private readonly rngMap = new Map<string, MRG1999a[]>();

	hasStarted = false;
	hasEnded = false;
	isConfiguring_ = false;  // Java の isConfiguring（関数 isConfiguring と名前がぶつかるので _ を付けた）

	private readonly pauseModelTarget: PauseModelTarget = new PauseModelTarget(this);

	private readonly thresholdChangedHandle = new EventHandle();
	private readonly thresholdChangedTarget = new JaamSimModel_ThresholdChangedTarget();

	private readonly undoList: Command[] = [];
	private readonly redoList: Command[] = [];

	constructor(name: string);
	constructor(sm: JaamSimModel, name: string);
	constructor(a: string | JaamSimModel, b?: string) {
		const name = typeof a === "string" ? a : b!;

		// JaamSimModel(String name)
		this.eventManager = new EventManager("DefaultEventManager");
		this.eventManager.setTimeListener(this);
		this.simulation = null;
		this.name = name;
		this.scenarioNumber = 1;
		this.replicationNumber = 1;
		this.scenarioIndexList = new IntegerVector();
		this.scenarioIndexList.add(1);

		if (typeof a === "string")
			return;

		// JaamSimModel(JaamSimModel sm, String name)
		const sm = a;
		//System.out.format("%nJaamSimModel constructor%n");
		this.autoLoad();
		this.setRecordEdits(true);

		this.configFile = sm.configFile;
		this.reportDir = sm.reportDir;

		// Ensure that 'getReportDirectory' works correctly for an Example Model
		if (this.reportDir == null && this.configFile == null)
			this.reportDir = sm.getReportDirectory();

		// Create the new entities in the same order as the original model
		for (const ent of sm.getClonesOfIterator(Entity)) {
			if (!ent.isRegistered())
				break;
			if (ent.isPreDefined() || this.getNamedEntity(ent.getName()) != null)
				continue;

			// Generate all the sub-model components when the first one is found
			if (ent.isGenerated() && ent.getParent() instanceof SubModel) {
				const clone = this.getNamedEntity(ent.getParent()!.getName()) as SubModel | null;
				if (clone == null)
					continue;
				clone.createComponents();
				continue;
			}

			// Define the new object
			let proto = ent.getPrototype();
			if (proto != null)
				proto = this.getNamedEntity(proto.getName());
			//System.out.format("defineEntity - ent=%s, proto=%s%n", ent, proto);
			InputAgent.defineEntityWithUniqueName(this, ent.constructor as JClass<Entity>, proto, ent.getName(), "_", true);
		}

		// Prepare a sorted list of registered entities on which to set inputs
		const entityList: Entity[] = [];
		for (const ent of sm.getClonesOfIterator(Entity)) {
			if (!ent.isRegistered())
				break;
			if (ent instanceof ObjectType)
				continue;
			entityList.push(ent);
		}
		entityList.sort(InputAgent.subModelSortOrder);

		// Stub definitions
		for (const ent of entityList) {
			if (ent.isGenerated())
				continue;
			for (const inp of ent.getEditableInputs()) {
				const stub = inp.getStubDefinition();
				if (stub == null || inp.getIsDef())
					continue;
				const newEnt = this.getNamedEntity(ent.getName());
				if (newEnt == null)
					throw new ErrorException("New entity not found: %s", ent.getName());
				const kw = KeywordIndex.formatInput(inp.getKeyword(), stub);
				InputAgent.apply(newEnt, kw);
			}
		}

		let context: ParseContext | null = null;
		if (sm.getConfigFile() != null) {
			const uri = JFile.toURI(JFile.getParent(sm.getConfigFile()!), true);
			context = new ParseContext(uri, null);
		}

		// Copy the early inputs to the new entities in the specified sequence of inputs
		for (const key of InputAgent.EARLY_KEYWORDS) {
			for (const ent of entityList) {
				const newEnt = this.getNamedEntity(ent.getName());
				if (newEnt == null)
					throw new ErrorException("New entity not found: %s", ent.getName());
				//System.out.format("Early Keyword - ent=%s, key=%s%n", ent, key);
				newEnt.copyInput(ent, key, context);
			}
		}

		// Copy the normal inputs to the new entities
		for (const ent of entityList) {
			const newEnt = this.getNamedEntity(ent.getName());
			if (newEnt == null)
				throw new ErrorException("New entity not found: %s", ent.getName());
			for (const inp of ent.getEditableInputs()) {
				if (inp.isSynonym() || InputAgent.isEarlyInput(inp)
						|| inp instanceof EntityNameInput
						|| inp instanceof ParentEntityInput)
					continue;
				const key = inp.getKeyword();
				//System.out.format("Normal Keyword - ent=%s, key=%s%n", ent, key);
				newEnt.copyInput(ent, key, context);
			}
		}

		// Complete the preparation of the sub-model clones
		this.postLoad();

		// Verify that the new JaamSimModel is an exact copy
		if (!this.isCopyOf(sm))
			throw new ErrorException("Copied JaamSimModel does not match the original");
	}

	/**
	 * Returns whether this JaamSimModel is a copy of the specified model.
	 * Avoids the complexities of overriding the equals method.
	 * @param sm - JaamSimModel to be compared
	 * @return true if the model is a copy
	 */
	isCopyOf(sm: JaamSimModel): boolean {

		// Loop through the two sets of registered entities in parallel
		// (any non-registered entities appear after all the registered entities)
		const itr0 = sm.getClonesOfIterator(Entity);
		const itr1 = this.getClonesOfIterator(Entity);
		while (itr0.hasNext() || itr1.hasNext()) {
			let ent0: Entity | null = null;
			let ent1: Entity | null = null;
			try {
				ent0 = itr0.hasNext() ? itr0.nextEnt() : null;
				ent1 = itr1.hasNext() ? itr1.nextEnt() : null;
			}
			catch (e) { /* Java も何もしない */ }
			if ((ent0 == null || !ent0.isRegistered()) && (ent1 == null || !ent1.isRegistered()))
				break;

			// Verify that the entity list contains the same sequence of objects
			if (ent0 == null || ent1 == null || !ent1.isCopyOf(ent0)) {
				console.log(jformat("Entity lists do not match: ent0=%s, ent1=%s", String(ent0), String(ent1)));
				return false;
			}
		}
		return true;
	}

	setGUIListener(l: GUIListener | null): void {
		this.gui = l;
	}

	getGUIListener(): GUIListener | null {
		return this.gui;
	}

	tickUpdate(tick: number): void {
		if (this.gui != null)
			this.gui.gui_tickUpdate(tick);
	}

	timeRunning(): void {
		if (this.gui != null)
			this.gui.gui_timeRunning();
	}

	handleError(t: unknown): void {
		this.recordError();
		this.runListener!.handleRuntimeError(this, t);
	}

	isStarted(): boolean {
		return this.hasStarted;
	}

	isEnded(): boolean {
		return this.hasEnded;
	}

	setConfiguring(config: boolean): void {
		this.isConfiguring_ = config;
	}

	isConfiguring(): boolean {
		return this.isConfiguring_;
	}

	isRealTime(): boolean {
		return this.simulation!.isRealTime();
	}

	getName(): string {
		return this.name;
	}

	/**
	 * Deletes all the objects in the present model and prepares the JaamSimModel to load a new
	 * input file using the autoLoad() and configure() methods.
	 */
	close(): void {
		this.closeLogFile();
		this.pause();
		for (const each of this.getClonesOfIterator(Entity)) {
			each.close();
		}
		this.eventManager.clear();
		this.hasStarted = false;
		this.hasEnded = false;

		let listNode = this.entityList.next;
		while(listNode !== this.entityList) {
			const curEnt = listNode.ent;
			if (curEnt != null && !curEnt.isDead()) {
				curEnt.kill();
			}
			listNode = listNode.next;
		}

		// Reset calendar
		this.calendar.setGregorian(false);
		this.startMillis = 0;
		this.calendarUsed = false;
		this.reloadReqd = false;

		// Clear the 'simulation' property
		this.simulation = null;

		// Reset the run number and run indices
		this.scenarioNumber = 1;
		this.replicationNumber = 1;

		this.configFile = null;
		this.reportDir = null;

		this.setSessionEdited(false);
		this.recordEditsFound = false;
		this.numErrors = 0;
		this.numWarnings = 0;
		this.lastTickForTrace = -1;
	}

	/**
	 * Pre-loads the simulation model with built-in objects such as Simulation and Units.
	 */
	autoLoad(): void {

		// Load the autoload.cfg file
		this.setRecordEdits(false);
		InputAgent.readResource(this, "<res>/inputs/autoload.cfg");

		// Save the number of entities created by the autoload.cfg file
		this.preDefinedEntityCount = this.getTailEntity()!.getEntityNumber();
	}

	/**
	 * Loads the specified configuration file to create the objects in the model.
	 * The autoLoad() method must be executed first.
	 * @param file - configuration file
	 * @throws URISyntaxException
	 */
	configure(file: string): void {
		this.configFile = file;
		this.name = JFile.getName(file);
		this.openLogFile();

		// Load the input file
		this.loadFile(file);

		// Perform any actions that are required after loading the input file
		this.postLoad();

		// Validate the inputs
		for (const each of this.getClonesOfIterator(Entity)) {
			if (each.hasClone())
				continue;

			try {
				each.validate();
			}
			catch (e) {
				this.recordError();
				this.logMessage("Validation Error - %s: %s%n", String(each), ErrorException.messageOf(e));
			}
		}

		//  Check for found errors
		if (this.getNumErrors() > 0)
			throw new InputErrorException(tr("%d input errors and %d warnings found"),
					this.getNumErrors(), this.getNumWarnings());

		if (this.getSimulation()!.getPrintInputReport())
			InputAgent.printInputFileKeywords(this);

		// The session is not considered to be edited after loading a configuration file
		this.setSessionEdited(false);

		// Save and close the input trace file
		if (this.numWarnings === 0 && this.numErrors === 0) {
			this.closeLogFile();

			// Open a fresh log file for the simulation run
			this.openLogFile();
		}
	}

	/**
	 * Parses configuration file records from the specified file.
	 * @param file - file containing the input records
	 * @throws URISyntaxException
	 */
	loadFile(file: string): void {
		const dirURI = JFile.toURI(JFile.getParent(file), true);
		InputAgent.readStream(this, "", dirURI, JFile.getName(file));
	}

	/**
	 * Performs any additional actions that are required for each entity after a new configuration
	 * file has been loaded. Performed prior to validation.
	 */
	postLoad(): void {
		for (const each of this.getClonesOfIterator(Entity)) {
			each.postLoad();
		}
	}

	start(l: RunListener | null, trc: EventTraceListener | null): void {
		if (l == null)
			throw new NullPointerException("A runlistener must be provided to start a run");
		this.runListener = l;

		this.prepareReportDirectory();
		this.killGeneratedEntities();
		this.eventManager.clear();
		this.hasStarted = false;
		this.hasEnded = false;

		// TODO(移植): events の EventManager に setTraceListener がまだ無い（事象の記録・照合が効かない）
		const em = this.eventManager as unknown as { setTraceListener?: (t: EventTraceListener | null) => void };
		if (em.setTraceListener !== undefined)
			em.setTraceListener(trc);
		this.eventManager.setTickLength(this.getSimulation()!.getTickLength());
		this.eventManager.scheduleProcessExternal(0, Entity.PRI_HIGHEST, Entity.EVT_LIFO, new InitModelTarget(this), null);
		this.resume();
	}

	/**
	 * Suspends model execution at the present simulation time.
	 */
	pause(): void {
		//System.out.format("%s.pause%n", this);
		this.eventManager.pause();
	}

	/**
	 * Resumes a paused simulation model.
	 * The model will continue execution until the specified simulation time at which the model
	 * will be paused.
	 * Events scheduled at the next pause time will not be executed until the model is resumed.
	 * スレッドを使わないので、この関数は、止まる（一時停止・終わり・誤り）まで事象を実行してから戻る。
	 * @param simTime - next pause time
	 */
	resume(): void {
		this.eventManager.resumeSeconds(this.getSimulation()!.getPauseTime());
	}

	/**
	 * Sets the simulation time to zero and re-initializes the model.
	 * The start() method can be used to begin a new simulation run.
	 */
	reset(): void {
		this.eventManager.pause();
		this.eventManager.clear();
		this.hasStarted = false;
		this.hasEnded = false;
		this.killGeneratedEntities();
		this.rngMap.clear();

		// Keep the labels and sub-models consistent with the gui
		if (this.getSimulation()!.isShowLabels())
			this.showTemporaryLabels();

		// Perform earlyInit
		for (const each of this.getClonesOfIterator(Entity)) {
			// Try/catch is required because some earlyInit methods use simTime which is only
			// available from a process thread, which is not the case when called from endRun
			try {
				each.earlyInit();
			} catch (e) {
				// Java は Exception だけを受ける
			}
		}

		// Perform lateInit
		for (const each of this.getClonesOfIterator(Entity)) {
			// Try/catch is required because some lateInit methods use simTime which is only
			// available from a process thread, which is not the case when called from endRun
			try {
				each.lateInit();
			} catch (e) {
				// Java は Exception だけを受ける
			}
		}
	}


	event_init(): void {
		this.hasStarted = true;
		//System.out.format("%ninit%n");
		const simulation = this.getSimulation()!;

		// Validation
		for (const each of this.getClonesOfIterator(Entity)) {
			if (each.hasClone())
				continue;

			try {
				each.validate();
			}
			catch (t) {
				let msg = jformat(tr("Validation Error - %s: %s%n"), String(each), ErrorException.messageOf(t));
				if (t instanceof ErrorException)
					msg = jformat(tr("Validation Error - %s%n"), t.getMessage());

				throw new ErrorException(msg);
			}
		}

		// Early Initialization
		this.thresholdChangedTarget.users.length = 0;
		for (const each of this.getClonesOfIterator(Entity)) {
			each.earlyInit();
		}

		// Late Initialization
		for (const each of this.getClonesOfIterator(Entity)) {
			each.lateInit();
		}

		// Schedule a starting event for each active Entity at the startup time
		const startTicks = this.eventManager.secondsToNearestTick(simulation.getStartTime());
		const initTicks = this.eventManager.secondsToNearestTick(simulation.getInitializationTime());
		const durationTicks = this.eventManager.secondsToNearestTick(simulation.getRunDuration());

		for (const each of this.getClonesOfIterator(Entity)) {
			if (!each.isActive())
				continue;
			EventManager.scheduleTicks(startTicks, Entity.PRI_HIGHEST, Entity.EVT_FIFO, new StartUpTarget(each), null);
		}

		// Schedule the statistics initialization if one has been set
		if (initTicks > 0)
			EventManager.scheduleTicks(startTicks + initTicks, Entity.PRI_NORMAL, Entity.EVT_LIFO, new ClearStatisticsTarget(this), null);

		// Schedule the end of the simulation run
		// TODO(移植): Java は long の足し算で桁あふれすることがある（2^63 を超える場合）。ここは 2^53 の手前で止まらない
		EventManager.scheduleTicks(startTicks + initTicks + durationTicks, Entity.PRI_NORMAL, Entity.EVT_LIFO, new EndModelTarget(this), null);

		// Start checking the pause condition
		if (simulation.isPauseConditionSet())
			EventManager.scheduleUntil(this.pauseModelTarget, this.pauseModelTarget.condition, null);
	}

	event_pause(): void {
		const simulation = this.getSimulation()!;

		// If specified, terminate the simulation run
		if (simulation.getExitAtPauseCondition()) {
			this.event_end();
			return;
		}

		// Pause the simulation run
		this.pause();

		// When the run is resumed, continue to check the pause condition
		if (simulation.isPauseConditionSet())
			EventManager.scheduleUntil(this.pauseModelTarget, this.pauseModelTarget.condition, null);
	}

	/**
	 * Reset the statistics for each entity.
	 */
	event_clearStatistics(): void {
		for (const ent of this.getClonesOfIterator(Entity)) {
			if (!ent.isActive())
				continue;
			ent.clearStatistics();
		}
	}

	/**
	 * Prepares the model for the next simulation run number.
	 */
	event_end(): void {
		this.hasEnded = true;
		this.pause();

		// Execute the end of run method for each entity
		for (const each of this.getClonesOfIterator(Entity)) {
			if (!each.isActive())
				continue;
			each.doEnd();
		}

		this.runListener!.runEnded();
	}

	/**
	 * Destroys the entities that were generated during the present simulation run.
	 */
	private killGeneratedEntities(): void {
		let listNode = this.entityList.next;
		while(listNode !== this.entityList) {
			const curEnt = listNode.ent;
			if (curEnt != null && !curEnt.isDead() && !curEnt.isRetained()) {
				curEnt.kill();
			}
			listNode = listNode.next;
		}
	}

	/**
	 * Returns whether events are being executed.
	 * @return true if the events are being executed
	 */
	isRunning(): boolean {
		return this.eventManager.isRunning();
	}

	/**
	 * Returns the present simulation time in seconds.
	 * @return simulation time
	 */
	getSimTime(): number {
		return this.eventManager.getSeconds();
	}

	getSimTicks(): number {
		return this.eventManager.getTicks();
	}

	/**
	 * Evaluates the specified expression and returns its value as a string.
	 * Any type of result can be returned by the expression, including an entity or an array.
	 * If it returns a number, it must be dimensionless.
	 * @param expString - expression to be evaluated
	 * @return expression value as a string
	 */
	getStringValue(expString: string): string {
		const simTime = this.getSimTime();
		try {
			const unitType: JClass<Unit> = DimensionlessUnit;
			const thisEnt: Entity = this.getSimulation()!;
			const strProv = new StringProvExpression(expString, thisEnt, unitType);
			return strProv.getNextString(thisEnt, simTime);
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
			return tr("Cannot evaluate");
		}
	}

	/**
	 * Evaluates the specified expression and returns its value.
	 * The expression must return a dimensionless number.
	 * All other types of expressions return NaN.
	 * @param expString - expression to be evaluated
	 * @return expression value
	 */
	getDoubleValue(expString: string): number {
		const simTime = this.getSimTime();
		try {
			const unitType: JClass<Unit> = DimensionlessUnit;
			const thisEnt: Entity = this.getSimulation()!;
			const sampleExp = new SampleExpression(expString, thisEnt, unitType);
			return sampleExp.getNextSample(thisEnt, simTime);
		}
		catch (e) {
			if (!(e instanceof ExpError)) throw e;
			return Number.NaN;
		}
	}

	/**
	 * Creates a new entity for the specified type and name.
	 * If the name already used, "_1", "_2", etc. will be appended to the name until an unused
	 * name is found.
	 * @param type - type of entity to be created
	 * @param name - absolute name for the created entity
	 */
	defineEntity(type: string, name: string): void {
		try {
			const klass = Input.parseEntityType(this, type);
			InputAgent.defineEntityWithUniqueName(this, klass, null, name, "_", true);
		}
		catch (e) {
			if (!(e instanceof InputErrorException)) throw e;
			throw new Error(String(e), { cause: e });  // Java: new RuntimeException(e)
		}
	}

	/**
	 * Sets the input for the specified entity and keyword to the specified string.
	 * @param entName - name of the entity whose input is to be set
	 * @param keyword - input keyword whose value is to be set
	 * @param arg - input string as it would appear in the Input Editor
	 */
	setInput(entName: string, keyword: string, arg: string): void {
		this.setRecordEdits(true);
		const ent = this.getNamedEntity(entName);
		if (ent == null)
			throw new ErrorException("Entity '%s' not found", entName);
		const kw = KeywordIndex.formatInput(keyword, arg);
		InputAgent.apply(ent, kw);
	}

	/**
	 * Writes the inputs for the simulation model to the specified file.
	 * @param file - file to which the model inputs are to be saved
	 */
	save(file: string): void {
		InputAgent.printNewConfigurationFileWithName(this, file);
		this.configFile = file;
		this.name = JFile.getName(file);
	}

	getEventManager(): EventManager {
		return this.eventManager;
	}

	setSimulation(sim: Simulation | null): void {
		this.simulation = sim;
	}

	getSimulation(): Simulation | null {
		return this.simulation;
	}

	isMultipleRuns(): boolean {
		return this.getSimulation()!.getNumberOfRuns() > 1;
	}

	isFirstRun(): boolean {
		return this.isFirstScenario() && this.replicationNumber === 1;
	}

	isLastRun(): boolean {
		return this.isLastScenario() && this.replicationNumber === this.getSimulation()!.getNumberOfReplications();
	}

	isFirstScenario(): boolean {
		return this.scenarioNumber === this.getSimulation()!.getStartingScenarioNumber();
	}

	isLastScenario(): boolean {
		return this.scenarioNumber >= this.getSimulation()!.getEndingScenarioNumber();
	}

	/**
	 * Returns the run indices that correspond to a given run number.
	 * @param n - run number.
	 * @param rangeList - maximum value for each index.
	 * @return run indices.
	 */
	static getRunIndexList(n: number, rangeList: IntegerVector): IntegerVector {
		if (rangeList.size() === 0) {
			const indexList = new IntegerVector(1);
			indexList.add(n);
			return indexList;
		}
		const indexList = new IntegerVector(rangeList.size());
		indexList.fillWithEntriesOf(rangeList.size(), 0);
		let denom = 1;
		for (let i=rangeList.size()-1; i>=0; i--) {
			indexList.set(i, Math.trunc((n-1)/denom) % rangeList.get(i) + 1);
			denom = Math.imul(denom, rangeList.get(i));  // int の掛け算（桁あふれも Java と同じ）
		}
		return indexList;
	}

	/**
	 * Returns the run number that corresponds to a given set of run indices.
	 * @param indexList - run indices.
	 * @param rangeList - maximum value for each index.
	 * @return run number.
	 */
	static getRunNumber(indexList: IntegerVector, rangeList: IntegerVector): number {
		let n = 1;
		let factor = 1;
		for (let i=indexList.size()-1; i>=0; i--) {
			n += (indexList.get(i)-1)*factor;
			factor = Math.imul(factor, rangeList.get(i));
		}
		return n;
	}

	/**
	 * Returns the input format used to specify a set of scenario indices.
	 * getScenarioCode() と static の getScenarioCode(indexList) は、static とインスタンスで別の関数にできる。
	 * @param indexList - scenario indices.
	 * @return scenario code.
	 */
	static getScenarioCode(indexList: IntegerVector): string {
		let sb = "";
		sb += String(indexList.get(0));
		for (let i=1; i<indexList.size(); i++) {
			sb += "-" + String(indexList.get(i));
		}
		return sb;
	}

	setScenarioNumber(n: number): void {
		this.scenarioNumber = n;
		this.setScenarioIndexList();
	}

	setScenarioIndexList(): void {
		this.scenarioIndexList = JaamSimModel.getRunIndexList(this.scenarioNumber, this.getSimulation()!.getScenarioIndexDefinitionList());
	}

	getScenarioNumber(): number {
		return this.scenarioNumber;
	}

	getScenarioIndexList(): IntegerVector {
		return this.scenarioIndexList;
	}

	getScenarioCode(): string {
		return JaamSimModel.getScenarioCode(this.scenarioIndexList);
	}

	setReplicationNumber(n: number): void {
		this.replicationNumber = n;
	}

	getReplicationNumber(): number {
		return this.replicationNumber;
	}

	getRunNumber(): number {
		const numberOfReplications = this.getSimulation()!.getNumberOfReplications();
		return (this.scenarioNumber - 1) * numberOfReplications + this.replicationNumber;
	}

	getRunHeader(): string {
		return jformat("##### SCENARIO %s - REPLICATION %s #####",
				this.getScenarioCode(), this.replicationNumber);
	}

	getNextEntityID(): number {
		return ++this.entityCount;
	}

	getNamedEntity(name: string): Entity | null {
		if (name.includes(".")) {
			const names = javaSplit(name, ".");
			return this.getEntityFromNames(names);
		}

		return this.namedEntities.get(name) ?? null;
	}

	getEntity(name: string): Entity | null {
		const ret = this.getNamedEntity(name);
		if (ret != null)
			return ret;
		for (const ent of this.getClonesOfIterator(Entity)) {
			if (ent.getName() === name) {
				return ent;
			}
		}
		return null;
	}

	// Get an entity from a chain of names, descending into the tree of children
	getEntityFromNames(names: string[]): Entity | null {
		let currEnt: Entity | null = this.getSimulation();
		for (const name of names) {
			if (currEnt == null) {
				return null;
			}
			currEnt = currEnt.getChild(name);
		}
		return currEnt;
	}

	getEntitySequence(): number {
		// Java: ((long)numLiveEnts << 32) + entityCount
		let seq = this.numLiveEnts * 4294967296;
		seq += this.entityCount;
		return seq;
	}

	idToEntity(id: number): Entity | null {
		let curNode = this.entityList.next;
		while(true) {
			if (curNode === this.entityList) {
				return null;
			}
			const curEnt = curNode.ent;
			if (curEnt != null && curEnt.getEntityNumber() === id) {
				return curEnt;
			}
			curNode = curNode.next;
		}
	}

	/**
	 * Creates a new entity.
	 * 引数が 1 つなら Java の createInstance(Class<T> klass)。
	 * @param klass - class for the entity
	 * @param proto - prototype for the entity
	 * @param name - entity local name
	 * @param parent - entity's parent
	 * @param added - true if the entity was defined after the 'RecordEdits' flag
	 * @param gen - true if the entity was created during the execution of the simulation
	 * @param reg - true if the entity is included in the namedEntities HashMap
	 * @param retain - true if the entity is retained when the model is reset between runs
	 * @return new entity
	 */
	createInstance<T extends Entity>(klass: JClass<T>): T | null;
	createInstance<T extends Entity>(klass: JClass<T>, proto: Entity | null, name: string, parent: Entity | null,
			added: boolean, gen: boolean, reg: boolean, retain: boolean): T | null;
	createInstance<T extends Entity>(klass: JClass<T>, proto?: Entity | null, name?: string, parent?: Entity | null,
			added?: boolean, gen?: boolean, reg?: boolean, retain?: boolean): T | null {
		if (name === undefined)
			return this.createInstance1(klass);

		const ent = this.createInstance1(klass);
		if (ent == null)
			return null;

		// Set the entity type
		if (added)
			ent.setFlag(Entity.FLAG_ADDED);
		if (gen)
			ent.setFlag(Entity.FLAG_GENERATED);
		if (reg)
			ent.setFlag(Entity.FLAG_REGISTERED);
		if (retain)
			ent.setFlag(Entity.FLAG_RETAINED);

		ent.setParentInput(parent ?? null);
		ent.setNameInput(name);
		ent.setPrototype(proto ?? null);

		// Create any objects associated with this entity and set their inputs
		// (These objects and their inputs are not be marked as 'edited' to avoid having them saved
		// to the input file)
		const bool = this.isRecordEdits();
		this.setRecordEdits(false);
		ent.postDefine();
		this.setRecordEdits(bool);

		return ent;
	}


	private static createModel: JaamSimModel | null = null;

	static getCreateModel(): JaamSimModel | null {
		const ret = JaamSimModel.createModel;
		JaamSimModel.createModel = null;
		return ret;
	}

	private createInstance1<T extends Entity>(klass: JClass<T>): T | null {
		let ent: T | null = null;
		try {
			// Java は他のスレッドが使い終わるまで待つ。1 つのスレッドなので、そのまま入れる
			JaamSimModel.createModel = this;
			ent = new (klass as new () => T)();
			this.addInstance(ent);
		}
		catch (e) {
			// Java は何もしない（null を返す）
			// TODO(移植): 誤りを捨てると原因が分からないので、記録だけは残す
			Log.logException(e);
		}

		return ent;
	}

	addNamedEntity(ent: Entity): void {
		if (ent.parent != null) {
			ent.parent.addChild(ent);
			return;
		}

		if (!ent.isRegistered())
			return;

		if (this.namedEntities.get(ent.entityName!) != null)
			throw new ErrorException("Entity name: %s is already in use.", ent.entityName);
		this.namedEntities.set(ent.entityName!, ent);
	}

	removeNamedEntity(ent: Entity): void {
		if (ent.parent != null) {
			ent.parent.removeChild(ent);
			return;
		}

		if (!ent.isRegistered())
			return;

		const old = this.namedEntities.get(ent.entityName!);
		this.namedEntities.delete(ent.entityName!);
		if (old !== ent)
			throw new ErrorException("Named Entities Internal Consistency error");
	}

	/**
	 * Changes the specified entity's name.
	 * @param ent - entity to be renamed
	 * @param newName - new local name for the entity
	 */
	renameEntity(ent: Entity, newName: string): void {
		if (ent.entityName != null)
			this.removeNamedEntity(ent);
		ent.entityName = newName;
		this.addNamedEntity(ent);

		if (this.gui != null) {
			this.gui.updateObjectSelector(ent);
		}
	}

	private validateEntList(): void {
		if (!JaamSimModel.VALIDATE_ENT_LIST) {
			return;
		}
		// Count the number of live entities and make sure all entity numbers are increasing
		// Also, check that the lastEnt reference is correct
		let numEntities = 0;
		let lastEntNum = -1;
		let numDeadEntities = 0;
		if (this.entityList.ent != null) {
			throw new ErrorException("Entity List Validation Error!");
		}

		let curNode: EntityListNode | null = this.entityList.next;
		let lastNode = this.entityList;
		while (curNode != null && curNode !== this.entityList) {
			const curEnt = curNode.ent!;
			if (!curEnt.isDead()) {
				numEntities++;
			} else {
				numDeadEntities++;
			}
			if (curEnt.getEntityNumber() <= lastEntNum) {
				throw new ErrorException("Entity List Validation Error!");
			}
			if (curNode.prev !== lastNode) {
				throw new ErrorException("Entity List Validation Error!");
			}
			lastEntNum = curEnt.getEntityNumber();
			lastNode = curNode;
			curNode = curNode.next;
		}
		if (numEntities !== this.numLiveEnts) {
			throw new ErrorException("Entity List Validation Error!");
		}
		if (this.entityList.prev !== lastNode) {
			throw new ErrorException("Entity List Validation Error!");
		}
		if (numDeadEntities > 0) {
			throw new ErrorException("Entity List Validation Error!");
		}
		if (curNode == null) {
			throw new ErrorException("Entity List Validation Error!");
		}

		// Scan the list backwards
		curNode = this.entityList.prev;
		lastNode = this.entityList;
		numEntities = 0;
		lastEntNum = Long.MAX_VALUE;
		while (curNode != null && curNode !== this.entityList) {
			const curEnt = curNode.ent!;
			if (!curEnt.isDead()) {
				numEntities++;
			} else {
				numDeadEntities++;
			}
			if (curEnt.getEntityNumber() >= lastEntNum) {
				throw new ErrorException("Entity List Validation Error!");
			}
			if (curNode.next !== lastNode) {
				throw new ErrorException("Entity List Validation Error!");
			}
			lastEntNum = curEnt.getEntityNumber();
			lastNode = curNode;
			curNode = curNode.prev;
		}
		if (numEntities !== this.numLiveEnts) {
			throw new ErrorException("Entity List Validation Error!");
		}
		if (this.entityList.next !== lastNode) {
			throw new ErrorException("Entity List Validation Error!");
		}
		if (numDeadEntities > 0) {
			throw new ErrorException("Entity List Validation Error!");
		}
		if (curNode == null) {
			throw new ErrorException("Entity List Validation Error!");
		}
	}

	addInstance(e: Entity): void {
		this.validateEntList();

		this.numLiveEnts++;

		const newNode = new EntityListNode(e);

		const oldLast = this.entityList.prev;
		newNode.prev = oldLast;
		newNode.next = this.entityList;
		oldLast.next = newNode;
		this.entityList.prev = newNode;
		this.validateEntList();
	}

	restoreInstance(e: Entity): void {
		this.validateEntList();
		this.numLiveEnts++;
		this.addNamedEntity(e);

		// Scan through the linked list to find the place to insert this entity
		// This is slow, but should only happen due to user actions
		const entNum = e.getEntityNumber();
		let curNode = this.entityList.next;

		while(true) {
			const nextEnt = curNode.next.ent;
			if (nextEnt == null || nextEnt.getEntityNumber() > entNum) {
				// End of the list or at the correct location

				// Insert a new node after curNode
				const newNode = new EntityListNode(e);

				newNode.next = curNode.next;
				newNode.prev = curNode;
				curNode.next = newNode;
				newNode.next.prev = newNode;
				this.validateEntList();
				return;
			}

			curNode = curNode.next;
		}
	}

	removeInstance(e: Entity): void {
		this.validateEntList();
		this.numLiveEnts--;
		this.removeNamedEntity(e);

		const listNode = e.listNode!;

		// Break the link to the list
		e.listNode = null;
		listNode.ent = null;

		listNode.next.prev = listNode.prev;
		listNode.prev.next = listNode.next;

		// Note, leaving the nodes next and prev pointers intact so that any outstanding iterators
		// can finish traversing the list
		this.validateEntList();
	}

	getEntityCount(): number {
		return this.numLiveEnts;
	}

	/**
	 * Returns an Iterator that loops over the instances of the specified class. It does not
	 * include instances of any sub-classes of the class.
	 * The specified class must be a sub-class of Entity.
	 * @param proto - specified class
	 * @return Iterator for instances of the class
	 */
	getInstanceIterator<T extends Entity>(proto: JClass<T>): InstanceIterable<T> {
		return new InstanceIterable<T>(this, proto);
	}

	/**
	 * Returns an Iterator that loops over the instances of the specified class and its
	 * sub-classes.
	 * The specified class must be a sub-class of Entity.
	 * 2 番目の引数（判定の関数）があれば、Java の getClonesOfIterator(Class proto, Class iface)。
	 * @param proto - specified class
	 * @param iface - specified interface（判定の関数。例: isRandomStreamUser）
	 * @return Iterator for instances of the class and its sub-classes
	 */
	getClonesOfIterator<T extends Entity>(proto: JClass<T>): ClonesOfIterable<T>;
	getClonesOfIterator<T extends Entity>(proto: JClass<T>, iface: (o: unknown) => boolean): ClonesOfIterableInterface<T>;
	getClonesOfIterator<T extends Entity>(proto: JClass<T>, iface?: (o: unknown) => boolean): ClonesOfIterable<T> | ClonesOfIterableInterface<T> {
		if (iface !== undefined)
			return new ClonesOfIterableInterface<T>(this, proto, iface);
		return new ClonesOfIterable<T>(this, proto);
	}

	// Note, these methods should only be called by EntityIterator and some unit tests
	getHeadEntity(): Entity | null {
		return this.entityList.next.ent;
	}
	getTailEntity(): Entity | null {
		return this.entityList.prev.ent;
	}
	getEntityList(): EntityListNode {
		return this.entityList;
	}


	addObjectType(ot: ObjectType): void {
		this.objectTypes.push(ot);
		this.objectTypeMap.set(ot.getJavaClass()!, ot);
	}

	removeObjectType(ot: ObjectType): void {
		jRemove(this.objectTypes, ot);
		this.objectTypeMap.delete(ot.getJavaClass()!);
	}

	getObjectTypes(): ObjectType[] {
		return this.objectTypes;
	}

	getObjectTypeForClass(klass: JClass | null): ObjectType | null {
		return this.objectTypeMap.get(klass as JClass<Entity>) ?? null;
	}

	updateThresholdUsers(userList: ThresholdUser[]): void {
		for (const user of userList) {
			if (!this.thresholdChangedTarget.users.includes(user))
				this.thresholdChangedTarget.users.push(user);
		}
		if (this.thresholdChangedTarget.users.length > 0 && !this.thresholdChangedHandle.isScheduled())
			EventManager.scheduleTicks(0, Entity.PRI_HIGH, Entity.EVT_LIFO, this.thresholdChangedTarget, this.thresholdChangedHandle);
	}

	/**
	 * Returns the present configuration file.
	 * Null is returned if no configuration file has been loaded or saved yet.
	 * @return present configuration file
	 */
	getConfigFile(): string | null {
		return this.configFile;
	}

	/**
	 * Returns the name of the simulation run.
	 * For example, if the model name is "case1.cfg", then the run name is "case1".
	 * @return name of the simulation run
	 */
	getRunName(): string {
		const simName = this.getName();
		const index = simName.lastIndexOf(".");
		if (index === -1)
			return simName;
		else
			return simName.substring(0, index);
	}

	private getReportDirectory(): string {
		if (this.reportDir != null)
			return this.reportDir;

		if (this.configFile != null)
			return JFile.getParent(this.configFile);

		return JaamSimModel.getPreferenceFolder("");
	}

	/**
	 * Java は Preferences（利用者ごとの設定）に持つ。ここは localStorage があればそれを使う。
	 * TODO(移植): 無いときは "."（Java の new File(".").getAbsolutePath() の代わり）
	 */
	static getPreferenceFolder(key: string): string {
		const store = getPreferenceStore();
		let folder = store?.getItem(PREF_NODE + key) ?? null;
		if (folder != null)
			return folder;

		folder = store?.getItem(PREF_NODE) ?? null;
		if (folder != null)
			return folder;

		return ".";
	}

	static setPreferenceFolder(key: string, path: string): void {
		const store = getPreferenceStore();
		store?.setItem(PREF_NODE + key, path);
	}

	/**
	 * Returns the path to the report file with the specified extension for this model.
	 * Returns null if the file path cannot be constructed.
	 * @param ext - file extension, e.g. ".dat"
	 * @return file path
	 */
	getReportFileName(ext: string): string {
		let sb = "";
		sb += this.getReportDirectory();
		sb += FileSystem.separator;
		sb += this.getRunName();
		sb += ext;
		return sb;
	}

	setReportDirectory(dir: string | null): void {
		this.reportDir = dir;
		if (this.reportDir == null)
			return;
		if (!JFile.exists(this.reportDir) && !JFile.mkdirs(this.reportDir))
			throw new InputErrorException(tr("Was unable to create the Report Directory: %s"), this.reportDir);
	}

	prepareReportDirectory(): void {
		if (this.reportDir != null) JFile.mkdirs(this.reportDir);
	}

	setBatchRun(bool: boolean): void {
		this.batchRun = bool;
	}

	isBatchRun(): boolean {
		return this.batchRun;
	}

	setScriptMode(bool: boolean): void {
		this.scriptMode = bool;
	}

	isScriptMode(): boolean {
		return this.scriptMode;
	}

	setSessionEdited(bool: boolean): void {
		this.sessionEdited = bool;
	}

	isSessionEdited(): boolean {
		return this.sessionEdited;
	}

	/**
	 * Specifies whether a RecordEdits marker was found in the present configuration file.
	 * @param bool - TRUE if a RecordEdits marker was found.
	 */
	setRecordEditsFound(bool: boolean): void {
		this.recordEditsFound = bool;
	}

	/**
	 * Indicates whether a RecordEdits marker was found in the present configuration file.
	 * @return - TRUE if a RecordEdits marker was found.
	 */
	isRecordEditsFound(): boolean {
		return this.recordEditsFound;
	}

	/**
	 * Sets the "RecordEdits" mode for the InputAgent.
	 * @param bool - boolean value for the RecordEdits mode
	 */
	setRecordEdits(bool: boolean): void {
		this.recordEdits = bool;
	}

	/**
	 * Returns the "RecordEdits" mode for the InputAgent.
	 * <p>
	 * When RecordEdits is TRUE, any model inputs that are changed and any objects that
	 * are defined are marked as "edited". When FALSE, model inputs and object
	 * definitions are marked as "unedited".
	 * <p>
	 * RecordEdits mode is used to determine the way JaamSim saves a configuration file
	 * through the graphical user interface. Object definitions and model inputs
	 * that are marked as unedited will be copied exactly as they appear in the original
	 * configuration file that was first loaded.  Object definitions and model inputs
	 * that are marked as edited will be generated automatically by the program.
	 *
	 * @return the RecordEdits mode for the InputAgent.
	 */
	isRecordEdits(): boolean {
		return this.recordEdits;
	}

	getLogFile(): FileEntity | null {
		return this.logFile;
	}

	openLogFile(): void {
		const logFileName = this.getRunName() + ".log";
		this.logFile = null;
		try {
			if (this.configFile == null)
				throw new NullPointerException("Cannot invoke \"java.io.File.toURI()\" because \"this.configFile\" is null");
			// Java: 設定のファイルの URI に対して、名前を解決する（同じフォルダの <名前>.log）
			const f = JFile.getParent(this.configFile) + FileSystem.separator + logFileName;
			if (JFile.exists(f) && !JFile.delete(f))
				throw new Error("Cannot delete an existing log file.");
			this.logFile = new FileEntity(this, f);
		}
		catch( e ) {
			this.logWarning("Could not create log file.%n%s", ErrorException.messageOf(e));
		}
	}

	closeLogFile(): void {
		if (this.logFile == null)
			return;

		this.logFile.close();

		// Delete the log file if no errors or warnings were recorded
		if (this.numErrors === 0 && this.numWarnings === 0) {
			this.logFile.delete();
		}

		this.logFile = null;
	}

	logFileMessage(msg: string): void {
		if (this.logFile == null)
			return;

		this.logFile.write(msg);
		this.logFile.newLine();
		this.logFile.flush();
	}

	private recordError(): void {
		this.numErrors++;
	}

	getNumErrors(): number {
		return this.numErrors;
	}

	private recordWarning(): void {
		this.numWarnings++;
	}

	getNumWarnings(): number {
		return this.numWarnings;
	}

	/**
	 * Writes an error or warning message to standard error, the Log Viewer, and the Log File.
	 * @param fmt - format for the message
	 * @param args - objects to be printed in the message
	 */
	logMessage(fmt: string, ...args: unknown[]): void {
		const msg = jformat(fmt, ...args);
		Log.logLine(msg);
		this.logFileMessage(msg);
	}

	/**
	 * Writes a warning message to standard error, the Log Viewer, and the Log File.
	 * 書式は中で tr する（利用者が読む警告なので）。
	 * @param fmt - format string for the warning message
	 * @param args - objects used by the format string
	 */
	logWarning(fmt: string, ...args: unknown[]): void {
		this.recordWarning();
		const msg = jformat(tr(fmt), ...args);
		this.logMessage("***WARNING*** %s%n", msg);
	}

	/**
	 * Writes an error message to standard error, the Log Viewer, and the Log File.
	 * 書式は中で tr する。
	 * @param fmt - format string for the error message
	 * @param args - objects used by the format string
	 */
	logError(fmt: string, ...args: unknown[]): void {
		this.recordError();
		const msg = jformat(tr(fmt), ...args);
		this.logMessage("*** ERROR *** %s%n", msg);
	}

	/**
	 * Writes a input error message to standard error, the Log Viewer, and the Log File.
	 * 書式は中で tr する。
	 * @param fmt - format string for the error message
	 * @param args - objects used by the format string
	 */
	logInpError(fmt: string, ...args: unknown[]): void {
		this.recordError();
		const msg = jformat(tr(fmt), ...args);
		this.logMessage("*** INPUT ERROR *** %s%n", msg);
	}

	/**
	 * Writes a stack trace to standard error, the Log Viewer, and the Log File.
	 * Java の StackTraceElement の代わりに、JavaScript のスタックの行を 1 行ずつ書く。
	 * @param t - exception to be traced
	 */
	logStackTrace(t: unknown): void {
		const stack = t instanceof Error && t.stack !== undefined ? t.stack.split("\n").slice(1) : [];
		for (const each of stack) {
			this.logMessage(each.trim());
		}
	}

	trace(indent: number, ent: Entity | null, fmt: string, ...args: unknown[]): void {
		if (!EventManager.hasCurrent())
			return;

		// Print a TIME header every time time has advanced
		const evt = EventManager.current();
		const traceTick = evt.getTicks();
		if (this.lastTickForTrace !== traceTick) {
			const unitFactor = this.getDisplayedUnitFactor(TimeUnit);
			const unitString = this.getDisplayedUnit(TimeUnit);
			stdoutWrite(jformat(" \nTIME = %.6f %s,  TICKS = %d\n",
					evt.ticksToSeconds(traceTick) / unitFactor, unitString,
					traceTick));
			this.lastTickForTrace = traceTick;
		}

		// Create an indent string to space the lines
		let str = "";
		for (let i = 0; i < indent; i++)
			str += "   ";

		// Append the Entity name if provided
		if (ent != null)
			str += ent.getName() + ":";

		str += jformat(fmt, ...args);
		stdoutWrite(str + "\n");
	}

	isPreDefinedEntity(ent: Entity): boolean {
		return ent.getEntityNumber() <= this.preDefinedEntityCount;
	}

	/**
	 * Sets the inputs for the calendar. The simulation can use the usual Gregorian calendar with
	 * leap years or it can use a simplified calendar with a fixed 365 days per year.
	 * @param bool - true for the Gregorian calendar, false for the simple calendar
	 * @param date - calendar date corresponding to zero simulation time
	 */
	setCalendar(bool: boolean, date: SimDate): void {
		if (this.calendarUsed)
			this.reloadReqd = true;

		this.calendar.setGregorian(bool);
		this.startMillis = this.calendar.getTimeInMillis(date.year, date.month - 1, date.dayOfMonth,
				date.hourOfDay, date.minute, date.second, date.millisecond);
	}

	/**
	 * Returns whether the model must be saved and reloaded before it can be executed.
	 * This can occur when the calendar type (simple vs. Gregorian) or start date has
	 * been changed AFTER one or more calendar date inputs has been converted to simulation
	 * time using the previous calendar inputs.
	 * @return true if the model must be saved and reloaded
	 */
	isReloadReqd(): boolean {
		return this.reloadReqd;
	}

	/**
	 * Returns the simulation time corresponding to the specified date.
	 * @param year - year
	 * @param month - month (0 - 11)
	 * @param dayOfMonth - day of the month (1 - 31)
	 * @param hourOfDay - hour of the day (0 - 23)
	 * @param minute - minutes (0 - 59)
	 * @param second - seconds (0 - 59)
	 * @param ms - millisecond (0 - 999)
	 * @return time in milliseconds from the epoch
	 */
	getCalendarMillis(year: number, month: number, dayOfMonth: number, hourOfDay: number, minute: number, second: number, ms: number): number {
		this.calendarUsed = true;
		return this.calendar.getTimeInMillis(year, month, dayOfMonth, hourOfDay, minute, second, ms);
	}

	/**
	 * Returns the simulation time in seconds that corresponds to the specified time in
	 * milliseconds from the epoch.
	 * @param millis - milliseconds from the epoch
	 * @return simulation time in seconds
	 */
	calendarMillisToSimTime(millis: number): number {
		return (millis - this.startMillis) / 1000.0;
	}

	/**
	 * Returns the time in milliseconds from the epoch that corresponds to the specified
	 * simulation time.
	 * @param simTime - simulation time in seconds
	 * @return milliseconds from the epoch
	 */
	simTimeToCalendarMillis(simTime: number): number {
		return Math.round(simTime * 1000.0) + this.startMillis;
	}

	/**
	 * Returns the date corresponding to the specified time in milliseconds from the epoch.
	 * @param millis - time in milliseconds from the epoch
	 * @return date for the specified time
	 */
	getCalendarDate(millis: number): Date {
		this.calendar.setTimeInMillis(millis);
		return this.calendar.getTime();
	}

	/**
	 * Returns the calendar date and time for the specified time in milliseconds from the epoch.
	 * @param millis - time in milliseconds from the epoch
	 * @return SimDate for the specified time
	 */
	getSimDate(millis: number): SimDate {
		this.calendar.setTimeInMillis(millis);
		return this.calendar.getSimDate();
	}

	/**
	 * Returns the day of week for the specified time in milliseconds from the epoch.
	 * @param millis - time in milliseconds from the epoch
	 * @return day of week (Sunday = 1, Monday = 2, ..., Saturday = 7)
	 */
	getDayOfWeek(millis: number): number {
		if (this.calendar.isGregorian()) {
			this.calendar.setTimeInMillis(millis);
			return this.calendar.get(Calendar.DAY_OF_WEEK);
		}
		this.calendar.setTimeInMillis(this.startMillis);
		const simDay = Math.trunc((millis - this.startMillis)/(1000*60*60*24));
		return ((this.calendar.get(Calendar.DAY_OF_WEEK) - 1 + simDay) % 7) + 1;
	}

	setPreferredUnitList(list: Unit[]): void {
		const utList: string[] = Unit.getUnitTypeList(this);

		// Set the preferred units in the list
		for (const u of list) {
			const ut = u.constructor as JClass<Unit>;
			this.setPreferredUnit(ut, u);
			jRemove(utList, ClassRegistry.simpleName(ut));
		}

		// Clear the entries for unit types that were not in the list
		for (const utName of utList) {
			const ut = Input.parseUnitType(this, utName);
			this.preferredUnit.delete(ut);
		}
	}

	setPreferredUnit(type: JClass<Unit>, u: Unit): void {
		if (u.getName() === Unit.getSIUnit(type)) {
			this.preferredUnit.delete(type);
			return;
		}
		this.preferredUnit.set(type, u);
	}

	getPreferredUnitList(): Unit[] {
		return [...this.preferredUnit.values()];
	}

	getPreferredUnit<T extends Unit>(type: JClass<T>): Unit | null {
		return this.preferredUnit.get(type) ?? null;
	}

	getDisplayedUnit<T extends Unit>(ut: JClass<T>): string {
		const u = this.getPreferredUnit(ut);
		if (u == null)
			return Unit.getSIUnit(ut);
		return u.getName();
	}

	getDisplayedUnitFactor<T extends Unit>(ut: JClass<T>): number {
		const u = this.getPreferredUnit(ut);
		if (u == null)
			return 1.0;
		return u.getConversionFactorToSI();
	}

	/**
	 * Returns an array of random number generators to be used by the random distribution functions
	 * provided by the expression system. If the seed input is set to -1, the next available random
	 * stream number is selected.
	 * @param key - identifies the random distribution function caller
	 * @param seed - stream number for the first random generator
	 * @param num - number of random generators required for the distribution function
	 * @return array of random generators
	 */
	getRandomGenerators(key: string, seed: number, num: number): MRG1999a[] {
		let ret = this.rngMap.get(key);
		if (ret === undefined) {
			ret = new Array<MRG1999a>(num);
			let streamNumber = seed;
			if (seed === -1)
				streamNumber = this.getSmallestAvailableStreamNumber();
			const substreamNumber = this.getSimulation()!.getSubstreamNumber();
			for (let i = 0; i < num; i++) {
				ret[i] = new MRG1999a(streamNumber + i, substreamNumber);
			}
			this.rngMap.set(key, ret);
		}
		if (ret.length !== num)
			throw new ErrorException("Incorrect number of random generators");
		return ret;
	}

	/**
	 * Returns the smallest random stream number that has not been used.
	 * @return smallest unused stream number
	 */
	getSmallestAvailableStreamNumber(): number {

		// Construct a list of stream numbers that have been used
		const userList: RandomStreamUser[] = [];
		for (const each of this.getClonesOfIterator(Entity, isRandomStreamUser)) {
			userList.push(each as unknown as RandomStreamUser);
		}
		const streamNumbers: number[] = new Array<number>(userList.length + this.rngMap.size).fill(0);

		for (let i = 0; i < userList.length; i++) {
			streamNumbers[i] = userList[i].getStreamNumber();
		}

		let k = userList.length;
		for (const rngArray of this.rngMap.values()) {
			streamNumbers[k] = rngArray[0].getStreamNumber();
			k++;
		}

		// Sort the stream number list and return the first unused integer
		streamNumbers.sort((a, b) => a - b);
		let ret = 1;
		for (let i = 0; i < streamNumbers.length; i++) {
			if (streamNumbers[i] > ret)
				return ret;
			if (streamNumbers[i] === ret)
				ret++;
		}
		return ret;
	}

	/**
	 * Returns a list of objects that use the specified random stream.
	 * @param seed - random stream number
	 * @return users of the random stream
	 */
	getRandomStreamUsers(seed: number): RandomStreamUser[] {
		const ret: RandomStreamUser[] = [];
		for (const each of this.getClonesOfIterator(Entity, isRandomStreamUser)) {
			const user = each as unknown as RandomStreamUser;
			if (user.getStreamNumber() === seed) {
				ret.push(user);
			}
		}
		return ret;
	}

	storeAndExecute(cmd: Command): void {
		if (!cmd.isChange())
			return;

		// Execute the command and catch an error if it occurs
		cmd.execute();

		// Attempt to merge the command with the previous one
		let mergedCmd: Command | null = null;
		if (this.undoList.length > 0) {
			const lastCmd = this.undoList[this.undoList.length - 1];
			mergedCmd = lastCmd.tryMerge(cmd);
		}

		// If the new command can be combined, then change the entry for previous command
		if (mergedCmd != null) {
			if (mergedCmd.isChange())
				this.undoList[this.undoList.length - 1] = mergedCmd;
			else
				this.undoList.pop();
		}

		// If the new command cannot be combined, then add it to the undo list
		else {
			this.undoList.push(cmd);
		}

		// Clear the re-do list
		this.redoList.length = 0;

		const gui = this.getGUIListener();
		if (gui != null)
			gui.updateAll();
	}

	canUndo(): boolean {
		return this.undoList.length > 0;
	}

	getUndoList(): Command[] {
		return this.undoList;
	}

	/** undo() と undo(n) を 1 つにした */
	undo(n = 1): void {
		for (let i = 0; i < n; i++) {
			if (this.undoList.length === 0)
				break;
			const cmd = this.undoList.pop()!;
			this.redoList.push(cmd);
			cmd.undo();
		}
		const gui = this.getGUIListener();
		if (gui != null)
			gui.updateAll();
	}

	canRedo(): boolean {
		return this.redoList.length > 0;
	}

	getRedoList(): Command[] {
		return this.redoList;
	}

	/** redo() と redo(n) を 1 つにした */
	redo(n = 1): void {
		for (let i = 0; i < n; i++) {
			if (this.redoList.length === 0)
				break;
			const cmd = this.redoList.pop()!;
			this.undoList.push(cmd);
			cmd.execute();
		}
		const gui = this.getGUIListener();
		if (gui != null)
			gui.updateAll();
	}

	private getRepeatCommand(ent: Entity): Command | null {
		if (this.undoList.length === 0 || this.redoList.length > 0)
			return null;
		let cmd: Command | null = this.undoList[this.undoList.length - 1];
		cmd = cmd.tryRepeat(ent);
		if (cmd == null || !cmd.isChange())
			return null;
		return cmd;
	}

	canRepeat(ent: Entity): boolean {
		return this.getRepeatCommand(ent) != null;
	}

	repeat(ent: Entity): void {
		const cmd = this.getRepeatCommand(ent);
		if (cmd == null)
			return;
		try {
			this.storeAndExecute(cmd);
		}
		catch (e) {
			if (this.gui != null)
				this.gui.invokeErrorDialogBox(tr("Input Error"), ErrorException.messageOf(e) ?? "null");
		}
	}

	canRedoOrRepeat(ent: Entity): boolean {
		return this.canRedo() || this.canRepeat(ent);
	}

	redoOrRepeat(ent: Entity): void {
		if (this.canRedo())
			this.redo();
		else if (this.canRepeat(ent))
			this.repeat(ent);
	}

	showTemporaryLabels(): void {
		for (const ent of this.getClonesOfIterator(DisplayEntity)) {
			if (!ent.canLabel())
				continue;
			EntityLabel.showTemporaryLabel(ent);
		}
	}

	toString(): string {
		return this.name;
	}

}

// Java の private static class JaamSimModel.ThresholdChangedTarget
class JaamSimModel_ThresholdChangedTarget extends ProcessTarget {
	public readonly users: ThresholdUser[] = [];

	constructor() {
		super();
	}

	override process(): void {
		for (let i = 0; i < this.users.length; i++) {
			this.users[i].thresholdChanged();
		}
		this.users.length = 0;
	}

	override getDescription(): string {
		return "UpdateAllThresholdUsers";
	}
}

/** Java の String.split（区切りは文字どおり。後ろの空の文字列は捨てる） */
function javaSplit(s: string, sep: string): string[] {
	const ret = s.split(sep);
	while (ret.length > 0 && ret[ret.length - 1] === "")
		ret.pop();
	return ret;
}

/** Java の System.out（Node なら process.stdout、無ければ console.log） */
function stdoutWrite(s: string): void {
	const proc = (globalThis as { process?: { stdout?: { write?: (s: string) => void } } }).process;
	if (proc?.stdout?.write !== undefined) {
		proc.stdout.write(s);
		return;
	}
	console.log(s.endsWith("\n") ? s.slice(0, -1) : s);
}

/** Java の Preferences.userRoot().node("com.jaamsim.ui.GUIFrame") の代わり */
const PREF_NODE = "com.jaamsim.ui.GUIFrame:";

function getPreferenceStore(): { getItem(k: string): string | null; setItem(k: string, v: string): void } | null {
	const ls = (globalThis as { localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void } }).localStorage;
	return ls ?? null;
}
