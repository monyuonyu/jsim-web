import { KeywordCommand } from "../Commands/KeywordCommand.ts";
import { SampleInput } from "../Samples/SampleInput.ts";
import { StringProvListInput } from "../StringProviders/StringProvListInput.ts";
import { IntegerVector } from "../datatypes/IntegerVector.ts";
import { tr } from "../i18n/I18n.ts";
import { BooleanInput } from "../input/BooleanInput.ts";
import { DateInput } from "../input/DateInput.ts";
import { DirInput } from "../input/DirInput.ts";
import { EntityListInput } from "../input/EntityListInput.ts";
import type { Input } from "../input/Input.ts";
import { InputCallback } from "../input/InputCallback.ts";
import { InputErrorException } from "../input/InputErrorException.ts";
import { IntegerInput } from "../input/IntegerInput.ts";
import { IntegerListInput } from "../input/IntegerListInput.ts";
import { KeywordIndex } from "../input/KeywordIndex.ts";
import { defineOutput } from "../input/OutputRegistry.ts";
import { RunNumberInput } from "../input/RunNumberInput.ts";
import { UnitTypeListInput } from "../input/UnitTypeListInput.ts";
import { ValueInput } from "../input/ValueInput.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { Double, Integer, JMath, jstr, Long } from "../java/lang.ts";
import { Vec3d } from "../math/Vec3d.ts";
import { DimensionlessUnit } from "../units/DimensionlessUnit.ts";
import { DistanceUnit } from "../units/DistanceUnit.ts";
import { TimeUnit } from "../units/TimeUnit.ts";
import { Unit } from "../units/Unit.ts";
import { Entity } from "./Entity.ts";
import { ErrorException } from "./ErrorException.ts";
import { Calendar, SimCalendar } from "./SimCalendar.ts";
import { SimDate } from "./SimDate.ts";
import type { WindowDefaults } from "./WindowDefaults.ts";

/** Java の com.jaamsim.ui.AboutBox の定数（画面の部品は移さないので、使う値だけをここに置いた） */
const AboutBox = {
	softwareName: "JaamSim",
	version: "2026-05",
};

/**
 * Simulation provides the basic structure for the Entity model lifetime of earlyInit,
 * startUp and doEndAt.  The initial processtargets required to start the model are
 * added to the eventmanager here.  This class also acts as a bridge to the UI by
 * providing controls for the various windows.
 *
 * 移植の注意:
 * - 入力のフィールド enableTracing は、Entity の関数 enableTracing(bool) と名前がぶつかるので enableTracingInput にした。
 * - getSnapGridPosition は、インスタンスの (pos)・(newPos, oldPos, shift) と、
 *   static の (pos, spacing)・(newPos, oldPos, spacing)・(newPos, oldPos, shift, spacing) を、引数の数で見分ける。
 */
export class Simulation extends Entity {

	private readonly runDuration: SampleInput;
	private readonly initializationTime: SampleInput;
	private readonly gregorianCalendar: BooleanInput;
	private readonly startDate: DateInput;
	private readonly pauseConditionInput: SampleInput;
	private readonly exitAtPauseCondition: BooleanInput;
	private readonly exitAtStop: BooleanInput;
	private readonly globalSeedInput: SampleInput;
	private readonly printReport: BooleanInput;
	private readonly reportDirectory: DirInput;
	private readonly unitTypeList: UnitTypeListInput;
	protected readonly runOutputList: StringProvListInput;
	protected readonly runParameterList: StringProvListInput;
	private readonly maxEntitiesToDisplay: IntegerInput;
	private readonly enableTracingInput: BooleanInput;
	private readonly traceEventsInput: BooleanInput;
	private readonly verifyEventsInput: BooleanInput;
	private readonly tickLengthInput: ValueInput;
	private readonly scenarioIndexDefinitionList: IntegerListInput;
	private readonly startingScenarioNumber: RunNumberInput;
	private readonly endingScenarioNumber: RunNumberInput;
	private readonly numberOfReplications: SampleInput;
	private readonly numberOfThreads: IntegerInput;
	private readonly printReplications: BooleanInput;
	private readonly printConfidenceIntervals: BooleanInput;
	private readonly printRunLabels: BooleanInput;
	private readonly displayedUnits: EntityListInput<Unit>;
	private readonly snapToGrid: BooleanInput;
	private readonly snapGridSpacing: ValueInput;
	private readonly incrementSize: ValueInput;
	private readonly realTime: BooleanInput;
	private readonly realTimeFactor: ValueInput;
	private readonly pauseTime: ValueInput;
	private readonly showLabels: BooleanInput;
	private readonly showSubModels: BooleanInput;
	private readonly presentationMode: BooleanInput;
	private readonly lockWindows: BooleanInput;
	private readonly showReferences: BooleanInput;
	private readonly showEntityFlow: BooleanInput;
	private readonly showModelBuilder: BooleanInput;
	private readonly showObjectSelector: BooleanInput;
	private readonly showInputEditor: BooleanInput;
	private readonly showOutputViewer: BooleanInput;
	private readonly showPropertyViewer: BooleanInput;
	private readonly showLogViewer: BooleanInput;
	private readonly showEventViewer: BooleanInput;
	private readonly modelBuilderPos: IntegerListInput;
	private readonly modelBuilderSize: IntegerListInput;
	private readonly objectSelectorPos: IntegerListInput;
	private readonly objectSelectorSize: IntegerListInput;
	private readonly inputEditorPos: IntegerListInput;
	private readonly inputEditorSize: IntegerListInput;
	private readonly outputViewerPos: IntegerListInput;
	private readonly outputViewerSize: IntegerListInput;
	private readonly propertyViewerPos: IntegerListInput;
	private readonly propertyViewerSize: IntegerListInput;
	private readonly logViewerPos: IntegerListInput;
	private readonly logViewerSize: IntegerListInput;
	private readonly eventViewerPos: IntegerListInput;
	private readonly eventViewerSize: IntegerListInput;
	private readonly controlPanelWidth: IntegerListInput;
	private readonly startTimeInput: ValueInput;
	private readonly printInputReport: BooleanInput;

	public static readonly DEFAULT_REAL_TIME_FACTOR = 1;
	public static readonly MIN_REAL_TIME_FACTOR = 1e-6;
	public static readonly MAX_REAL_TIME_FACTOR = 1e8;

	private static readonly modelBuilderPosDef = Simulation.makeDef(2);
	private static readonly modelBuilderSizeDef = Simulation.makeDef(2);
	private static readonly objectSelectorPosDef = Simulation.makeDef(2);
	private static readonly objectSelectorSizeDef = Simulation.makeDef(2);
	private static readonly inputEditorPosDef = Simulation.makeDef(2);
	private static readonly inputEditorSizeDef = Simulation.makeDef(2);
	private static readonly outputViewerPosDef = Simulation.makeDef(2);
	private static readonly outputViewerSizeDef = Simulation.makeDef(2);
	private static readonly propertyViewerPosDef = Simulation.makeDef(2);
	private static readonly propertyViewerSizeDef = Simulation.makeDef(2);
	private static readonly logViewerPosDef = Simulation.makeDef(2);
	private static readonly logViewerSizeDef = Simulation.makeDef(2);
	private static readonly eventViewerPosDef = Simulation.makeDef(2);
	private static readonly eventViewerSizeDef = Simulation.makeDef(2);
	private static readonly controlPanelWidthDef = Simulation.makeDef(1);

	// Java の static ブロック: new IntegerVector(n) に fillWithEntriesOf(n, 1)
	private static makeDef(n: number): IntegerVector {
		const ret = new IntegerVector(n);
		ret.fillWithEntriesOf(n, 1);
		return ret;
	}

	constructor() {
		super();

		// ---- Java の初期化ブロック ----
		// Key Inputs tab
		this.runDuration = new SampleInput("RunDuration", Entity.KEY_INPUTS, 31536000.0);
		this.setKeywordDoc(this.runDuration, "The duration of the simulation run in which all statistics will be recorded.",
				["8760 h"]);
		this.runDuration.setUnitType(TimeUnit);
		this.runDuration.setValidRange(1e-15, Double.POSITIVE_INFINITY);
		this.runDuration.setReportable(true);
		this.addInput(this.runDuration);

		this.initializationTime = new SampleInput("InitializationDuration", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.initializationTime, "The initialization interval for the simulation run. The model will "
	                     + "run for the InitializationDuration interval and then clear the "
	                     + "statistics and execute for the specified RunDuration interval. "
	                     + "The total length of the simulation run will be the sum of the "
	                     + "InitializationDuration and RunDuration inputs.",
				["720 h"]);
		this.initializationTime.setUnitType(TimeUnit);
		this.initializationTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.initializationTime.setReportable(true);
		this.addInput(this.initializationTime);

		this.gregorianCalendar = new BooleanInput("GregorianCalendar", Entity.OPTIONS, false);
		this.setKeywordDoc(this.gregorianCalendar, "If TRUE, the simulation uses the standard Gregorian calendar that "
	                     + "includes leap years. "
	                     + "If FALSE, the simulation uses a simplified calendar that has a fixed "
	                     + "365 days per year.",
				[]);
		this.gregorianCalendar.setCallback(Simulation.calendarCallback);
		this.addInput(this.gregorianCalendar);

		this.startDate = new DateInput("StartDate", Entity.OPTIONS, new SimDate(1970, 1, 1));
		this.setKeywordDoc(this.startDate, "The calendar date and time that corresponds to zero simulation time.",
				["2000-09-01", "'2000-09-01 00:08:00'"]);
		this.startDate.setCallback(Simulation.calendarCallback);
		this.addInput(this.startDate);

		this.pauseConditionInput = new SampleInput("PauseCondition", Entity.OPTIONS, Double.NaN);
		this.setKeywordDoc(this.pauseConditionInput, "An optional expression that pauses the run when TRUE is returned.",
				["'[Queue1].QueueLength > 20'"]);
		this.pauseConditionInput.setUnitType(DimensionlessUnit);
		this.addInput(this.pauseConditionInput);

		this.exitAtPauseCondition = new BooleanInput("ExitAtPauseCondition", Entity.OPTIONS, false);
		this.setKeywordDoc(this.exitAtPauseCondition, "If TRUE, the simulation run will be terminated when the "
	                     + "PauseCondition expression returns TRUE. If multiple runs have been "
	                     + "specified, then the next run will be started. If no more runs have "
	                     + "been specified, the simulation will be paused or terminated "
	                     + "depending on the input to the ExitAtStop keyword.",
				[]);
		this.addInput(this.exitAtPauseCondition);

		this.exitAtStop = new BooleanInput("ExitAtStop", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.exitAtStop, "If TRUE, the program will be closed on completion of the last "
	                     + "simulation run. Otherwise, the last run will be paused.",
				[]);
		this.addInput(this.exitAtStop);

		this.globalSeedInput = SampleInput.ofInt("GlobalSubstreamSeed", Entity.KEY_INPUTS, 0);
		this.setKeywordDoc(this.globalSeedInput, "Substream number applied to each probability distribution in the "
	                     + "model. "
	                     + "Accepts an integer value >= 0.\n\n"
	                     + "GlobalSubstreamSeed works together with the 'RandomSeed' input for "
	                     + "each probability distribution to determine its random sequence. "
	                     + "It allows the user to change all the random sequences in a model with "
	                     + "a single input.\n\n"
	                     + "The default value is the replication number for the simulation run "
	                     + "being executed, which is appropriate for most applications.",
				["5", "'this.ReplicationNumber + 100'"]);
		this.globalSeedInput.setUnitType(DimensionlessUnit);
		this.globalSeedInput.setIntegerValue(true);
		this.globalSeedInput.setValidRange(0, Integer.MAX_VALUE);
		this.globalSeedInput.setDefaultText("this.ReplicationNumber");
		this.addInput(this.globalSeedInput);

		this.printReport = new BooleanInput("PrintReport", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.printReport, "If TRUE, a full output report is printed to the file "
	                     + "<configuration file name>.rep at the end of the simulation run.",
				[]);
		this.addInput(this.printReport);

		this.reportDirectory = new DirInput("ReportDirectory", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.reportDirectory, "The directory in which to place the output report. Defaults to the "
	                     + "directory containing the configuration file for the run.",
				["'c:/reports/'"]);
		this.reportDirectory.setDefaultText("Configuration File Directory");
		this.reportDirectory.setCallback(Simulation.reportDirectoryCallback);
		this.addInput(this.reportDirectory);

		this.unitTypeList = new UnitTypeListInput("UnitTypeList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.unitTypeList, "Not Used",
				[]);
		this.unitTypeList.setHidden(true);
		this.addInput(this.unitTypeList);

		this.runOutputList = new StringProvListInput("RunOutputList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.runOutputList, "One or more selected outputs to be printed in tabular form to a "
	                     + "custom output report. "
	                     + "One row is printed to the report at the end of each simulation run. "
	                     + "An additional row is printed at the end of each scenario that "
	                     + "displays the aggregate average value and the 95% confidence interval "
	                     + "for each output."
	                     + "\n\n"
	                     + "In script mode (-s tag), the selected outputs are printed to the "
	                     + "command line (standard out). "
	                     + "Otherwise, they are printed to the file <configuration file name>.dat."
	                     + "\n\n"
	                     + "It is best to include only dimensionless quantities and non-numeric "
	                     + "outputs in the RunOutputList. "
	                     + "An output with dimensions can be made non-dimensional by dividing it "
	                     + "by 1 in the desired unit, e.g. '[Queue1].AverageQueueTime / 1[h]' is "
	                     + "the average queue time in hours. "
	                     + "A dimensional number will be displayed along with its unit. "
	                     + "The 'format' function can be used if a fixed number of decimal places "
	                     + "is required.",
				["{ [Queue1].QueueLengthAverage } { [Queue1].AverageQueueTime/1[h] }"]);
		this.addInput(this.runOutputList);

		this.runParameterList = new StringProvListInput("RunParameterList", Entity.KEY_INPUTS, null);
		this.setKeywordDoc(this.runParameterList, "One or more selected outputs that specify the key inputs to each "
	                     + "scenario. "
	                     + "These values appear at the beginning of each row of the custom output "
	                     + "report.",
				["{ [RunInputs].IAT/1[min] } { [RunInputs].ServiceTime/1[min] }"]);
		this.addInput(this.runParameterList);

		this.maxEntitiesToDisplay = new IntegerInput("MaxEntitiesToDisplay", Entity.OPTIONS, 10000);
		this.setKeywordDoc(this.maxEntitiesToDisplay, "The maximum number of entities to display in the view windows. "
	                     + "A model can contain more than this number of entities, but only this "
	                     + "number will be displayed. "
	                     + "This limit prevents JaamSim from becoming unresponsive when the "
	                     + "number of entities in a model exceeds the graphics capabilities of "
	                     + "the computer.",
				["100000"]);
		this.maxEntitiesToDisplay.setValidRange(0, Integer.MAX_VALUE);
		this.addInput(this.maxEntitiesToDisplay);

		this.enableTracingInput = new BooleanInput("EnableTracing", Entity.OPTIONS, false);
		this.setKeywordDoc(this.enableTracingInput, "If TRUE, the 'Trace' keyword for each object is activated. "
	                     + "For an object to be traced, both the 'EnableTracing' input for "
	                     + "Simulation and the 'Trace' input for the object must be set to TRUE. "
	                     + "Trace outputs are written to standard out and can used by a "
	                     + "programmer to track the internal logic for one or more selected "
	                     + "objects as the model is executed. "
	                     + "Tracing is an essential tool for testing and debugging the Java code "
	                     + "for JaamSim.",
				[]);
		this.enableTracingInput.setCallback(Simulation.enableTracingCallback);
		this.addInput(this.enableTracingInput);

		this.traceEventsInput = new BooleanInput("TraceEvents", Entity.OPTIONS, false);
		this.setKeywordDoc(this.traceEventsInput, "If TRUE, an additional output file is generated that traces the exact "
	                     + "sequence of events executed by the model. "
	                     + "The event file is named <configuration file name>.evt and is placed "
	                     + "in the same folder as the configuration file.",
				[]);
		this.addInput(this.traceEventsInput);

		this.verifyEventsInput = new BooleanInput("VerifyEvents", Entity.OPTIONS, false);
		this.setKeywordDoc(this.verifyEventsInput, "If TRUE, the events executed by the model are compared to those in an "
	                     + "event file that was generated previously using the TraceEvents "
	                     + "keyword. "
	                     + "An error message is generated if an event executed by the model "
	                     + "differs in any way from the ones specified by the event file. "
	                     + "The event file must be named <configuration file name>.evt and placed "
	                     + "in the same folder as the configuration file.",
				[]);
		this.addInput(this.verifyEventsInput);

		this.tickLengthInput = new ValueInput("TickLength", Entity.OPTIONS, 1e-6);
		this.setKeywordDoc(this.tickLengthInput, "The length of time represented by one simulation tick.",
				["1e-6 s"]);
		this.tickLengthInput.setUnitType(TimeUnit);
		this.tickLengthInput.setValidRange(1e-12, Double.POSITIVE_INFINITY);
		this.addInput(this.tickLengthInput);

		// Multiple Runs tab
		this.scenarioIndexDefinitionList = new IntegerListInput("ScenarioIndexDefinitionList", Entity.MULTIPLE_RUNS, new IntegerVector());
		this.setKeywordDoc(this.scenarioIndexDefinitionList, "Defines the number of scenario indices and the maximum value N for "
	                     + "each index. "
	                     + "When running multiple scenarios, each index will be iterated from "
	                     + "1 to N starting with the last index. "
	                     + "One scenario will be executed for every combination of the scenario "
	                     + "index values. "
	                     + "For example, if three scenario indices are defined with ranges of 3, "
	                     + "5, and 10, then a total of 3*5*10 = 150 scenarios will be executed.\n\n"
	                     + "If left blank, a single scenario index is defined and there are no "
	                     + "restrictions on the values that can be assigned to the "
	                     + "StartingScenarioNumber and EndingScenarioNumber inputs.",
				["3 5 10"]);
		this.scenarioIndexDefinitionList.setCallback(Simulation.scenarioIndexDefinitionListCallback);
		this.addInput(this.scenarioIndexDefinitionList);
		this.addSynonym(this.scenarioIndexDefinitionList, "RunIndexDefinitionList");

		this.startingScenarioNumber = new RunNumberInput("StartingScenarioNumber", Entity.MULTIPLE_RUNS, 1);
		this.setKeywordDoc(this.startingScenarioNumber, "The first scenario number to be executed.",
				["22", "1-3-2"]);
		this.startingScenarioNumber.setUnitType(DimensionlessUnit);
		this.startingScenarioNumber.setIntegerValue(true);
		this.startingScenarioNumber.setValidRange(1, Integer.MAX_VALUE);
		this.startingScenarioNumber.setCallback(Simulation.startingScenarioNumberCallback);
		this.addInput(this.startingScenarioNumber);
		this.addSynonym(this.startingScenarioNumber, "StartingRunNumber");

		this.endingScenarioNumber = new RunNumberInput("EndingScenarioNumber", Entity.MULTIPLE_RUNS, 1);
		this.setKeywordDoc(this.endingScenarioNumber, "The last scenario number to be executed.\n\n"
	                     + "The default value is the 'StartingScenarioNumber' input.",
				["78", "2-3-8"]);
		this.endingScenarioNumber.setUnitType(DimensionlessUnit);
		this.endingScenarioNumber.setIntegerValue(true);
		this.endingScenarioNumber.setValidRange(1, Integer.MAX_VALUE);
		this.endingScenarioNumber.setDefaultText("StartingScenarioNumber");
		this.addInput(this.endingScenarioNumber);
		this.addSynonym(this.endingScenarioNumber, "EndingRunNumber");

		this.numberOfReplications = SampleInput.ofInt("NumberOfReplications", Entity.MULTIPLE_RUNS, 1);
		this.setKeywordDoc(this.numberOfReplications, "The number of replications to perform for each scenario.",
				["10"]);
		this.numberOfReplications.setUnitType(DimensionlessUnit);
		this.numberOfReplications.setIntegerValue(true);
		this.numberOfReplications.setValidRange(1, Integer.MAX_VALUE);
		this.addInput(this.numberOfReplications);

		this.numberOfThreads = new IntegerInput("NumberOfThreads", Entity.MULTIPLE_RUNS, 1);
		this.setKeywordDoc(this.numberOfThreads, "The number of simulation runs to perform simultaneously while "
	                     + "executing the specified number of scenarios and replications.",
				["10"]);
		this.numberOfThreads.setValidRange(1, Integer.MAX_VALUE);
		this.addInput(this.numberOfThreads);

		this.printReplications = new BooleanInput("PrintReplications", Entity.MULTIPLE_RUNS, true);
		this.setKeywordDoc(this.printReplications, "If TRUE, the run output report will include an entry for each "
	                     + "replication that was performed. "
	                     + "If FALSE, the report will show entries only for the scenarios.",
				[]);
		this.addInput(this.printReplications);

		this.printConfidenceIntervals = new BooleanInput("PrintConfidenceIntervals", Entity.MULTIPLE_RUNS, true);
		this.setKeywordDoc(this.printConfidenceIntervals, "If TRUE, the run output report will include the 95% confidence "
	                     + "intervals for the outputs defined by the input to RunOutputList "
	                     + "keyword. "
	                     + "The confidence intervals are calculated using the factor for the "
	                     + "Student's T distribution corresponding to 95% confidence and the "
	                     + "standard deviation for the output values over the replications.",
				[]);
		this.addInput(this.printConfidenceIntervals);

		this.printRunLabels = new BooleanInput("PrintRunLabels", Entity.MULTIPLE_RUNS, true);
		this.setKeywordDoc(this.printRunLabels, "If TRUE, the first column of the run output report will show "
	                     + "the scenario number for each simulation run. "
	                     + "If the PrintReplications input is also TRUE, then the second column "
	                     + "will show the replication number.",
				[]);
		this.addInput(this.printRunLabels);

		// Entity.GUI tab
		this.displayedUnits = new EntityListInput<Unit>(Unit, "DisplayedUnits", Entity.GUI, []);
		this.setKeywordDoc(this.displayedUnits, "An optional list of units to be used for displaying model outputs.",
				["h kt"]);
		this.displayedUnits.setDefaultText("SI Units");
		this.displayedUnits.setPromptReqd(false);
		this.displayedUnits.setHidden(true);
		this.displayedUnits.setCallback(Simulation.displayedUnitsCallback);
		this.addInput(this.displayedUnits);

		this.realTime = new BooleanInput("RealTime", Entity.GUI, false);
		this.setKeywordDoc(this.realTime, "If TRUE, the simulation is executed a constant multiple of real time. "
	                     + "Otherwise, the run is executed as fast as possible, limited only by "
	                     + "processor speed.",
				[]);
		this.realTime.setPromptReqd(false);
		this.realTime.setHidden(true);
		this.addInput(this.realTime);

		this.snapToGrid = new BooleanInput("SnapToGrid", Entity.GUI, false);
		this.setKeywordDoc(this.snapToGrid, "If TRUE, a dragged object will be positioned to the nearest grid "
	                     + "point.",
				[]);
		this.snapToGrid.setPromptReqd(false);
		this.snapToGrid.setHidden(true);
		this.addInput(this.snapToGrid);

		this.snapGridSpacing = new ValueInput("SnapGridSpacing", Entity.GUI, 0.1);
		this.setKeywordDoc(this.snapGridSpacing, "The distance between snap grid points.",
				["1 m"]);
		this.snapGridSpacing.setUnitType(DistanceUnit);
		this.snapGridSpacing.setValidRange(1.0e-6, Double.POSITIVE_INFINITY);
		this.snapGridSpacing.setPromptReqd(false);
		this.snapGridSpacing.setHidden(true);
		this.addInput(this.snapGridSpacing);

		this.incrementSize = new ValueInput("IncrementSize", Entity.GUI, 0.1);
		this.setKeywordDoc(this.incrementSize, "The distance moved by the selected entity when the an arrow key is "
	                     + "pressed. Defaults to the SnapGridSpacing value.",
				["1 cm"]);
		this.incrementSize.setUnitType(DistanceUnit);
		this.incrementSize.setValidRange(1.0e-6, Double.POSITIVE_INFINITY);
		this.incrementSize.setPromptReqd(false);
		this.incrementSize.setHidden(true);
		this.addInput(this.incrementSize);

		this.realTimeFactor = new ValueInput("RealTimeFactor", Entity.GUI, Simulation.DEFAULT_REAL_TIME_FACTOR);
		this.setKeywordDoc(this.realTimeFactor, "The target ratio of elapsed simulation time to elapsed real time.",
				["1200"]);
		this.realTimeFactor.setValidRange(Simulation.MIN_REAL_TIME_FACTOR, Simulation.MAX_REAL_TIME_FACTOR);
		this.realTimeFactor.setPromptReqd(false);
		this.realTimeFactor.setHidden(true);
		this.addInput(this.realTimeFactor);

		this.pauseTime = new ValueInput("PauseTime", Entity.GUI, Double.POSITIVE_INFINITY);
		this.setKeywordDoc(this.pauseTime, "The time at which the simulation will be paused.",
				["200 h"]);
		this.pauseTime.setUnitType(TimeUnit);
		this.pauseTime.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.pauseTime.setPromptReqd(false);
		this.pauseTime.setHidden(true);
		this.addInput(this.pauseTime);

		this.showLabels = new BooleanInput("ShowLabels", Entity.GUI, false);
		this.setKeywordDoc(this.showLabels, "The state of the 'Show Labels' button on the Control Panel.",
				[]);
		this.showLabels.setPromptReqd(false);
		this.showLabels.setHidden(true);
		this.addInput(this.showLabels);

		this.showSubModels = new BooleanInput("ShowSubModels", Entity.GUI, false);
		this.setKeywordDoc(this.showSubModels, "The state of the 'Show SubModels' button on the Control Panel.",
				[]);
		this.showSubModels.setPromptReqd(false);
		this.showSubModels.setHidden(true);
		this.addInput(this.showSubModels);

		this.presentationMode = new BooleanInput("PresentationMode", Entity.GUI, false);
		this.setKeywordDoc(this.presentationMode, "The state of the 'Presentation Mode' button on the Control Panel.",
				[]);
		this.presentationMode.setPromptReqd(false);
		this.presentationMode.setHidden(true);
		this.addInput(this.presentationMode);

		this.lockWindows = new BooleanInput("LockWindows", Entity.GUI, false);
		this.setKeywordDoc(this.lockWindows, "The state of the 'LockWindows' button on the Control Panel.",
				[]);
		this.lockWindows.setPromptReqd(false);
		this.lockWindows.setHidden(true);
		this.lockWindows.setCallback(Simulation.lockWindowsCallback);
		this.addInput(this.lockWindows);

		this.showReferences = new BooleanInput("ShowReferences", Entity.GUI, false);
		this.setKeywordDoc(this.showReferences, "The state of the 'Show References' button on the Control Panel.",
				[]);
		this.showReferences.setPromptReqd(false);
		this.showReferences.setHidden(true);
		this.addInput(this.showReferences);

		this.showEntityFlow = new BooleanInput("ShowEntityFlow", Entity.GUI, false);
		this.setKeywordDoc(this.showEntityFlow, "The state of the 'Show Entity Flow' button on the Control Panel.",
				[]);
		this.showEntityFlow.setPromptReqd(false);
		this.showEntityFlow.setHidden(true);
		this.addInput(this.showEntityFlow);

		this.showModelBuilder = new BooleanInput("ShowModelBuilder", Entity.GUI, false);
		this.setKeywordDoc(this.showModelBuilder, "If TRUE, the Model Builder tool is shown on startup.",
				[]);
		this.showModelBuilder.setPromptReqd(false);
		this.showModelBuilder.setHidden(true);
		this.addInput(this.showModelBuilder);

		this.showObjectSelector = new BooleanInput("ShowObjectSelector", Entity.GUI, false);
		this.setKeywordDoc(this.showObjectSelector, "If TRUE, the Object Selector tool is shown on startup.",
				[]);
		this.showObjectSelector.setPromptReqd(false);
		this.showObjectSelector.setHidden(true);
		this.addInput(this.showObjectSelector);

		this.showInputEditor = new BooleanInput("ShowInputEditor", Entity.GUI, false);
		this.setKeywordDoc(this.showInputEditor, "If TRUE, the Input Editor tool is shown on startup.",
				[]);
		this.showInputEditor.setPromptReqd(false);
		this.showInputEditor.setHidden(true);
		this.addInput(this.showInputEditor);

		this.showOutputViewer = new BooleanInput("ShowOutputViewer", Entity.GUI, false);
		this.setKeywordDoc(this.showOutputViewer, "If TRUE, the Output Viewer tool is shown on startup.",
				[]);
		this.showOutputViewer.setPromptReqd(false);
		this.showOutputViewer.setHidden(true);
		this.addInput(this.showOutputViewer);

		this.showPropertyViewer = new BooleanInput("ShowPropertyViewer", Entity.GUI, false);
		this.setKeywordDoc(this.showPropertyViewer, "If TRUE, the Property Viewer tool is shown on startup.",
				[]);
		this.showPropertyViewer.setPromptReqd(false);
		this.showPropertyViewer.setHidden(true);
		this.addInput(this.showPropertyViewer);

		this.showLogViewer = new BooleanInput("ShowLogViewer", Entity.GUI, false);
		this.setKeywordDoc(this.showLogViewer, "If TRUE, the Log Viewer tool is shown on startup.",
				[]);
		this.showLogViewer.setPromptReqd(false);
		this.showLogViewer.setHidden(true);
		this.addInput(this.showLogViewer);

		this.showEventViewer = new BooleanInput("ShowEventViewer", Entity.GUI, false);
		this.setKeywordDoc(this.showEventViewer, "If TRUE, the Event Viewer tool is shown on startup.",
				[]);
		this.showEventViewer.setPromptReqd(false);
		this.showEventViewer.setHidden(true);
		this.addInput(this.showEventViewer);

		this.modelBuilderPos = new IntegerListInput("ModelBuilderPos", Entity.GUI, Simulation.modelBuilderPosDef);
		this.setKeywordDoc(this.modelBuilderPos, "The position of the upper left corner of the Model Builder window "
	                     + "in pixels measured from the top left corner of the screen.",
				["220 110"]);
		this.modelBuilderPos.setValidCount(2);
		this.modelBuilderPos.setValidRange(-8192, 8192);
		this.modelBuilderPos.setPromptReqd(false);
		this.modelBuilderPos.setHidden(true);
		this.addInput(this.modelBuilderPos);

		this.modelBuilderSize = new IntegerListInput("ModelBuilderSize", Entity.GUI, Simulation.modelBuilderSizeDef);
		this.setKeywordDoc(this.modelBuilderSize, "The size of the Model Builder window in pixels (width, height).",
				["500 300"]);
		this.modelBuilderSize.setValidCount(2);
		this.modelBuilderSize.setValidRange(1, 8192);
		this.modelBuilderSize.setPromptReqd(false);
		this.modelBuilderSize.setHidden(true);
		this.addInput(this.modelBuilderSize);

		this.objectSelectorPos = new IntegerListInput("ObjectSelectorPos", Entity.GUI, Simulation.objectSelectorPosDef);
		this.setKeywordDoc(this.objectSelectorPos, "The position of the upper left corner of the Object Selector window "
	                     + "in pixels measured from the top left corner of the screen.",
				["220 110"]);
		this.objectSelectorPos.setValidCount(2);
		this.objectSelectorPos.setValidRange(-8192, 8192);
		this.objectSelectorPos.setPromptReqd(false);
		this.objectSelectorPos.setHidden(true);
		this.addInput(this.objectSelectorPos);

		this.objectSelectorSize = new IntegerListInput("ObjectSelectorSize", Entity.GUI, Simulation.objectSelectorSizeDef);
		this.setKeywordDoc(this.objectSelectorSize, "The size of the Object Selector window in pixels (width, height).",
				["500 300"]);
		this.objectSelectorSize.setValidCount(2);
		this.objectSelectorSize.setValidRange(1, 8192);
		this.objectSelectorSize.setPromptReqd(false);
		this.objectSelectorSize.setHidden(true);
		this.addInput(this.objectSelectorSize);

		this.inputEditorPos = new IntegerListInput("InputEditorPos", Entity.GUI, Simulation.inputEditorPosDef);
		this.setKeywordDoc(this.inputEditorPos, "The position of the upper left corner of the Input Editor window "
	                     + "in pixels measured from the top left corner of the screen.",
				["220 110"]);
		this.inputEditorPos.setValidCount(2);
		this.inputEditorPos.setValidRange(-8192, 8192);
		this.inputEditorPos.setPromptReqd(false);
		this.inputEditorPos.setHidden(true);
		this.addInput(this.inputEditorPos);

		this.inputEditorSize = new IntegerListInput("InputEditorSize", Entity.GUI, Simulation.inputEditorSizeDef);
		this.setKeywordDoc(this.inputEditorSize, "The size of the Input Editor window in pixels (width, height).",
				["500 300"]);
		this.inputEditorSize.setValidCount(2);
		this.inputEditorSize.setValidRange(1, 8192);
		this.inputEditorSize.setPromptReqd(false);
		this.inputEditorSize.setHidden(true);
		this.addInput(this.inputEditorSize);

		this.outputViewerPos = new IntegerListInput("OutputViewerPos", Entity.GUI, Simulation.outputViewerPosDef);
		this.setKeywordDoc(this.outputViewerPos, "The position of the upper left corner of the Output Viewer window "
	                     + "in pixels measured from the top left corner of the screen.",
				["220 110"]);
		this.outputViewerPos.setValidCount(2);
		this.outputViewerPos.setValidRange(-8192, 8192);
		this.outputViewerPos.setPromptReqd(false);
		this.outputViewerPos.setHidden(true);
		this.addInput(this.outputViewerPos);

		this.outputViewerSize = new IntegerListInput("OutputViewerSize", Entity.GUI, Simulation.outputViewerSizeDef);
		this.setKeywordDoc(this.outputViewerSize, "The size of the Output Viewer window in pixels (width, height).",
				["500 300"]);
		this.outputViewerSize.setValidCount(2);
		this.outputViewerSize.setValidRange(1, 8192);
		this.outputViewerSize.setPromptReqd(false);
		this.outputViewerSize.setHidden(true);
		this.addInput(this.outputViewerSize);

		this.propertyViewerPos = new IntegerListInput("PropertyViewerPos", Entity.GUI, Simulation.propertyViewerPosDef);
		this.setKeywordDoc(this.propertyViewerPos, "The position of the upper left corner of the Property Viewer window "
	                     + "in pixels measured from the top left corner of the screen.",
				["220 110"]);
		this.propertyViewerPos.setValidCount(2);
		this.propertyViewerPos.setValidRange(-8192, 8192);
		this.propertyViewerPos.setPromptReqd(false);
		this.propertyViewerPos.setHidden(true);
		this.addInput(this.propertyViewerPos);

		this.propertyViewerSize = new IntegerListInput("PropertyViewerSize", Entity.GUI, Simulation.propertyViewerSizeDef);
		this.setKeywordDoc(this.propertyViewerSize, "The size of the Property Viewer window in pixels (width, height).",
				["500 300"]);
		this.propertyViewerSize.setValidCount(2);
		this.propertyViewerSize.setValidRange(1, 8192);
		this.propertyViewerSize.setPromptReqd(false);
		this.propertyViewerSize.setHidden(true);
		this.addInput(this.propertyViewerSize);

		this.logViewerPos = new IntegerListInput("LogViewerPos", Entity.GUI, Simulation.logViewerPosDef);
		this.setKeywordDoc(this.logViewerPos, "The position of the upper left corner of the Log Viewer window "
	                     + "in pixels measured from the top left corner of the screen.",
				["220 110"]);
		this.logViewerPos.setValidCount(2);
		this.logViewerPos.setValidRange(-8192, 8192);
		this.logViewerPos.setPromptReqd(false);
		this.logViewerPos.setHidden(true);
		this.addInput(this.logViewerPos);

		this.logViewerSize = new IntegerListInput("LogViewerSize", Entity.GUI, Simulation.logViewerSizeDef);
		this.setKeywordDoc(this.logViewerSize, "The size of the Log Viewer window in pixels (width, height).",
				["500 300"]);
		this.logViewerSize.setValidCount(2);
		this.logViewerSize.setValidRange(1, 8192);
		this.logViewerSize.setPromptReqd(false);
		this.logViewerSize.setHidden(true);
		this.addInput(this.logViewerSize);

		this.eventViewerPos = new IntegerListInput("EventViewerPos", Entity.GUI, Simulation.eventViewerPosDef);
		this.setKeywordDoc(this.eventViewerPos, "The position of the upper left corner of the Event Viewer window "
	                     + "in pixels measured from the top left corner of the screen.",
				["220 110"]);
		this.eventViewerPos.setValidCount(2);
		this.eventViewerPos.setValidRange(-8192, 8192);
		this.eventViewerPos.setPromptReqd(false);
		this.eventViewerPos.setHidden(true);
		this.addInput(this.eventViewerPos);

		this.eventViewerSize = new IntegerListInput("EventViewerSize", Entity.GUI, Simulation.eventViewerSizeDef);
		this.setKeywordDoc(this.eventViewerSize, "The size of the Event Viewer window in pixels (width, height).",
				["500 300"]);
		this.eventViewerSize.setValidCount(2);
		this.eventViewerSize.setValidRange(1, 8192);
		this.eventViewerSize.setPromptReqd(false);
		this.eventViewerSize.setHidden(true);
		this.addInput(this.eventViewerSize);

		this.controlPanelWidth = new IntegerListInput("ControlPanelWidth", Entity.GUI, Simulation.controlPanelWidthDef);
		this.setKeywordDoc(this.controlPanelWidth, "The width of the Control Panel window in pixels.",
				["1920"]);
		this.controlPanelWidth.setValidCount(1);
		this.controlPanelWidth.setValidRange(1, 8192);
		this.controlPanelWidth.setPromptReqd(false);
		this.controlPanelWidth.setHidden(true);
		this.addInput(this.controlPanelWidth);

		// Hidden keywords
		this.startTimeInput = new ValueInput("StartTime", Entity.KEY_INPUTS, 0.0);
		this.setKeywordDoc(this.startTimeInput, "Time at which the simulation run is started (hh:mm).",
				["2160 h"]);
		this.startTimeInput.setUnitType(TimeUnit);
		this.startTimeInput.setValidRange(0.0, Double.POSITIVE_INFINITY);
		this.startTimeInput.setHidden(true);
		this.addInput(this.startTimeInput);

		this.printInputReport = new BooleanInput("PrintInputReport", Entity.KEY_INPUTS, false);
		this.setKeywordDoc(this.printInputReport, "If TRUE, then the input report file will be printed after loading "
	                     + "the configuration file.  The input report can always be generated "
	                     + "when needed by selecting \"Print Input Report\" under the File menu.",
				[]);
		this.printInputReport.setHidden(true);
		this.addInput(this.printInputReport);


		// ---- Java のコンストラクタ ----
		if (this.getJaamSimModel().getSimulation() != null)
			throw new ErrorException("Cannot Define a second Simulation object");
		this.getJaamSimModel().setSimulation(this);
	}

	override setNameInput(localName: string): void {
		super.setNameInput(localName);
		this.nameInput.setLocked(true);
	}

	override setParentInput(newParent: Entity | null): void {
		super.setParentInput(newParent);
		this.parentInput.setLocked(true);
	}

	static readonly calendarCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, _inp: Input<unknown>): void {
			const sim = ent as Simulation;

			sim.getJaamSimModel().setCalendar(sim.isGregorianCalendar(), sim.getStartDate());
		}
	})();

	static readonly reportDirectoryCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, inp: Input<unknown>): void {
			const sim = ent as Simulation;
			const dirinp = inp as unknown as DirInput;
			sim.getJaamSimModel().setReportDirectory(dirinp.getDir());
		}
	})();

	static readonly enableTracingCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, inp: Input<unknown>): void {
			const bool = (inp as unknown as BooleanInput).getValue() as boolean;
			for (const e of ent.getJaamSimModel().getClonesOfIterator(Entity)) {
				e.enableTracing(bool);
			}
		}
	})();

	static readonly startingScenarioNumberCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, _inp: Input<unknown>): void {
			const sim = ent as Simulation;

			sim.getJaamSimModel().setScenarioNumber(sim.getStartingScenarioNumber());
		}
	})();

	static readonly displayedUnitsCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, _inp: Input<unknown>): void {
			(ent as Simulation).displayUnitsCallback();
		}
	})();

	displayUnitsCallback(): void {
		this.getJaamSimModel().setPreferredUnitList(this.displayedUnits.getValue() as Unit[]);
	}

	static readonly scenarioIndexDefinitionListCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, _inp: Input<unknown>): void {
			(ent as Simulation).scenarioIndexDefinitionListCallback();
		}
	})();

	scenarioIndexDefinitionListCallback(): void {
		this.getJaamSimModel().setScenarioIndexList();
		this.startingScenarioNumber.setRunIndexRangeList(this.getScenarioIndexDefinitionList());
		this.endingScenarioNumber.setRunIndexRangeList(this.getScenarioIndexDefinitionList());
	}

	static readonly lockWindowsCallback: InputCallback = new (class extends InputCallback {
		override callback(ent: Entity, inp: Input<unknown>): void {
			const bool = inp.getValue() as boolean;
			const gui = ent.getJaamSimModel().getGUIListener();
			if (gui != null)
				gui.allowResizing(!bool);
		}
	})();

	override validate(): void {
		super.validate();

		if (this.getJaamSimModel().isReloadReqd())
			throw new InputErrorException(tr("Inputs to GregorianCalendar or StartDate have changed "
					+ "AFTER the simulation calendar has been used to process another input.%n"
					+ "Re-open the model to process these inputs in the correct order."));

		// TODO(移植): Java の Long.MAX_VALUE は 2^63-1。ここは lang.ts の Long.MAX_VALUE（2^53-1）ではなく Java の値を使う
		const maxRunDuration = JAVA_LONG_MAX_AS_DOUBLE*(this.tickLengthInput.getValue() as number);
		if (this.getRunDuration() > maxRunDuration) {
			throw new InputErrorException(tr("RunDuration exceeds the maximum value of %g seconds.\n"
					+ "Received: %g seconds.\n"
					+ "The maximum value can be increased by increasing the TickLength input.\n"
					+ "Present value: %g seconds."),
					maxRunDuration, this.runDuration.getValue(), this.tickLengthInput.getValue());
		}
	}

	override earlyInit(): void {
		super.earlyInit();
		this.unitTypeList.reset();  // Delete an unnecessary input
	}

	override getChild(name: string): Entity | null {
		return this.getJaamSimModel().getNamedEntity(name);
	}

	getSubstreamNumber(): number {
		if (this.globalSeedInput.isDefault())
			return this.getJaamSimModel().getReplicationNumber();
		return toInt(this.globalSeedInput.getNextSample(this, 0.0));
	}

	getPrintReport(): boolean {
		return this.printReport.getValue() as boolean;
	}

	traceEvents(): boolean {
		return this.traceEventsInput.getValue() as boolean;
	}

	verifyEvents(): boolean {
		return this.verifyEventsInput.getValue() as boolean;
	}

	getTickLength(): number {
		return this.tickLengthInput.getValue() as number;
	}

	getPauseTime(): number {
		if (this.getJaamSimModel().isBatchRun())
			return Double.POSITIVE_INFINITY;
		return this.pauseTime.getValue() as number;
	}

	getPauseTimeString(): string {
		return this.pauseTime.getValueString();
	}

	/**
	 * Returns the start time of the run.
	 * @return - simulation time in seconds for the start of the run.
	 */
	getStartTime(): number {
		return this.startTimeInput.getValue() as number;
	}

	/**
	 * Returns the duration of the run (not including intialization)
	 */
	getRunDuration(): number {
		return this.runDuration.getNextSample(this, 0.0);
	}

	/**
	 * Returns the duration of the initialization period
	 */
	getInitializationTime(): number {
		return this.initializationTime.getNextSample(this, 0.0);
	}

	/**
	 * Returns whether a Gregorian calendar with leap years and leap seconds is used.
	 * @return true if the calendar is Gregorian
	 */
	isGregorianCalendar(): boolean {
		return this.gregorianCalendar.getValue() as boolean;
	}

	/**
	 * Returns the calendar date corresponding to zero simulation time.
	 */
	getStartDate(): SimDate {
		return this.startDate.getValue() as SimDate;
	}

	/**
	 * Returns the decimal fraction of the present run that has been completed for the specified
	 * simulation time.
	 * @param simTime - present simulation time
	 * @return fraction completed
	 */
	getProgress(simTime: number): number {
		return (simTime - this.getStartTime()) / (this.getRunDuration() + this.getInitializationTime());
	}

	getRunOutputListSize(): number {
		return this.runOutputList.getListSize();
	}

	getRunOutputHeaders(): string[] {
		const ret: string[] = [];
		for (let i = 0; i < this.runOutputList.getListSize(); i++) {
			ret.push(String((this.runOutputList.getValue() as unknown[])[i]));
		}
		return ret;
	}

	getRunOutputStrings(simTime: number): string[] {
		const ret: string[] = [];
		for (let i = 0; i < this.runOutputList.getListSize(); i++) {
			ret.push(this.runOutputList.getNextString(i, this, simTime));
		}
		return ret;
	}

	getRunOutputValues(simTime: number): number[] {
		const ret: number[] = [];
		for (let i = 0; i < this.runOutputList.getListSize(); i++) {
			ret.push(this.runOutputList.getNextValue(i, this, simTime));
		}
		return ret;
	}

	getRunParameterHeaders(): string[] {
		const ret: string[] = [];
		for (let i = 0; i < this.runParameterList.getListSize(); i++) {
			ret.push(String((this.runParameterList.getValue() as unknown[])[i]));
		}
		return ret;
	}

	getRunParameterStrings(simTime: number): string[] {
		const ret: string[] = [];
		for (let i = 0; i < this.runParameterList.getListSize(); i++) {
			ret.push(this.runParameterList.getNextString(i, this, simTime));
		}
		return ret;
	}

	getMaxEntitiesToDisplay(): number {
		return this.maxEntitiesToDisplay.getValue() as number;
	}

	override isEnableTracing(): boolean {
		return this.enableTracingInput.getValue() as boolean;
	}

	isShowLabels(): boolean {
		return this.showLabels.getValue() as boolean;
	}

	isShowSubModels(): boolean {
		return this.showSubModels.getValue() as boolean;
	}

	isPresentationMode(): boolean {
		return this.presentationMode.getValue() as boolean;
	}

	isLockWindows(): boolean {
		return this.lockWindows.getValue() as boolean;
	}

	isShowReferences(): boolean {
		return this.showReferences.getValue() as boolean;
	}

	isShowEntityFlow(): boolean {
		return this.showEntityFlow.getValue() as boolean;
	}

	getIncrementSize(): number {
		if (this.incrementSize.isDefault())
			return this.snapGridSpacing.getValue() as number;
		return this.incrementSize.getValue() as number;
	}

	isSnapToGrid(): boolean {
		return this.snapToGrid.getValue() as boolean;
	}

	getSnapGridSpacing(): number {
		return this.snapGridSpacing.getValue() as number;
	}

	getSnapGridSpacingString(): string {
		if (this.snapGridSpacing.isDefault())
			return this.snapGridSpacing.getDefaultString(this.getJaamSimModel());
		return this.snapGridSpacing.getValueString();
	}

	getExitAtPauseCondition(): boolean {
		return this.exitAtPauseCondition.getValue() as boolean;
	}

	isPauseConditionSet(): boolean {
		return !this.pauseConditionInput.isDefault();
	}

	isPauseConditionSatisfied(simTime: number): boolean {
		return !this.pauseConditionInput.isDefault() &&
				this.pauseConditionInput.getNextSample(this, simTime) !== 0.0;
	}

	/** Java の getSnapGridPosition(Vec3d pos) と getSnapGridPosition(Vec3d newPos, Vec3d oldPos, boolean shift) */
	getSnapGridPosition(pos: Vec3d): Vec3d;
	getSnapGridPosition(newPos: Vec3d, oldPos: Vec3d, shift: boolean): Vec3d;
	getSnapGridPosition(newPos: Vec3d, oldPos?: Vec3d, shift?: boolean): Vec3d {
		if (oldPos === undefined)
			return Simulation.getSnapGridPosition(newPos, this.getSnapGridSpacing());
		return Simulation.getSnapGridPosition(newPos, oldPos, shift!, this.getSnapGridSpacing());
	}

	/**
	 * static の 3 つを、引数の数で見分ける:
	 * (pos, spacing): Returns the nearest point on the snap grid to the given coordinate.
	 * (newPos, oldPos, spacing): Returns the nearest point on the snap grid to the given coordinate.
	 *   To avoid dithering, the new position must be at least one grid space
	 *   from the old position.
	 * (newPos, oldPos, shift, spacing)
	 */
	static getSnapGridPosition(pos: Vec3d, spacing: number): Vec3d;
	static getSnapGridPosition(newPos: Vec3d, oldPos: Vec3d, spacing: number): Vec3d;
	static getSnapGridPosition(newPos: Vec3d, oldPos: Vec3d, shift: boolean, spacing: number): Vec3d;
	static getSnapGridPosition(a: Vec3d, b: Vec3d | number, c?: number | boolean, d?: number): Vec3d {
		// (Vec3d pos, double spacing)
		if (typeof b === "number") {
			const spacing = b;
			const ret = new Vec3d(a);
			ret.x = spacing*JMath.rint(ret.x/spacing);
			ret.y = spacing*JMath.rint(ret.y/spacing);
			ret.z = spacing*JMath.rint(ret.z/spacing);
			return ret;
		}

		// (Vec3d newPos, Vec3d oldPos, double spacing)
		if (typeof c === "number") {
			const newPos = a, oldPos = b, spacing = c;
			const ret = new Vec3d(newPos);
			if (Math.abs(newPos.x - oldPos.x) < spacing)
				ret.x = oldPos.x;
			if (Math.abs(newPos.y - oldPos.y) < spacing)
				ret.y = oldPos.y;
			if (Math.abs(newPos.z - oldPos.z) < spacing)
				ret.z = oldPos.z;
			return Simulation.getSnapGridPosition(ret, spacing);
		}

		// (Vec3d newPos, Vec3d oldPos, boolean shift, double spacing)
		const newPos = a, oldPos = b, shift = c!, spacing = d!;
		const ret = Simulation.getSnapGridPosition(newPos, oldPos, spacing);
		if (shift) {
			ret.x = oldPos.x;
			ret.y = oldPos.y;
		}
		else {
			ret.z = oldPos.z;
		}
		return ret;
	}

	getExitAtStop(): boolean {
		return this.exitAtStop.getValue() as boolean;
	}

	getPrintInputReport(): boolean {
		return this.printInputReport.getValue() as boolean;
	}

	isRealTime(): boolean {
		return this.realTime.getValue() as boolean;
	}

	getRealTimeFactor(): number {
		return this.realTimeFactor.getValue() as number;
	}

	resetWindowPositionsAndSizes(): void {
		const kws: KeywordIndex[] = new Array<KeywordIndex>(15);
		kws[0] = KeywordIndex.formatArgs(this.modelBuilderPos.getKeyword());
		kws[1] = KeywordIndex.formatArgs(this.modelBuilderSize.getKeyword());
		kws[2] = KeywordIndex.formatArgs(this.objectSelectorPos.getKeyword());
		kws[3] = KeywordIndex.formatArgs(this.objectSelectorSize.getKeyword());
		kws[4] = KeywordIndex.formatArgs(this.inputEditorPos.getKeyword());
		kws[5] = KeywordIndex.formatArgs(this.inputEditorSize.getKeyword());
		kws[6] = KeywordIndex.formatArgs(this.outputViewerPos.getKeyword());
		kws[7] = KeywordIndex.formatArgs(this.outputViewerSize.getKeyword());
		kws[8] = KeywordIndex.formatArgs(this.propertyViewerPos.getKeyword());
		kws[9] = KeywordIndex.formatArgs(this.propertyViewerSize.getKeyword());
		kws[10] = KeywordIndex.formatArgs(this.logViewerPos.getKeyword());
		kws[11] = KeywordIndex.formatArgs(this.logViewerSize.getKeyword());
		kws[12] = KeywordIndex.formatArgs(this.eventViewerPos.getKeyword());
		kws[13] = KeywordIndex.formatArgs(this.eventViewerSize.getKeyword());
		kws[14] = KeywordIndex.formatArgs(this.controlPanelWidth.getKeyword());
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kws));
	}

	getModelBuilderPos(): IntegerVector {
		return this.modelBuilderPos.getValue() as IntegerVector;
	}

	getModelBuilderSize(): IntegerVector {
		return this.modelBuilderSize.getValue() as IntegerVector;
	}

	getObjectSelectorPos(): IntegerVector {
		return this.objectSelectorPos.getValue() as IntegerVector;
	}

	getObjectSelectorSize(): IntegerVector {
		return this.objectSelectorSize.getValue() as IntegerVector;
	}

	getInputEditorPos(): IntegerVector {
		return this.inputEditorPos.getValue() as IntegerVector;
	}

	getInputEditorSize(): IntegerVector {
		return this.inputEditorSize.getValue() as IntegerVector;
	}

	getOutputViewerPos(): IntegerVector {
		return this.outputViewerPos.getValue() as IntegerVector;
	}

	getOutputViewerSize(): IntegerVector {
		return this.outputViewerSize.getValue() as IntegerVector;
	}

	getPropertyViewerPos(): IntegerVector {
		return this.propertyViewerPos.getValue() as IntegerVector;
	}

	getPropertyViewerSize(): IntegerVector {
		return this.propertyViewerSize.getValue() as IntegerVector;
	}

	getLogViewerPos(): IntegerVector {
		return this.logViewerPos.getValue() as IntegerVector;
	}

	getLogViewerSize(): IntegerVector {
		return this.logViewerSize.getValue() as IntegerVector;
	}

	getEventViewerPos(): IntegerVector {
		return this.eventViewerPos.getValue() as IntegerVector;
	}

	getEventViewerSize(): IntegerVector {
		return this.eventViewerSize.getValue() as IntegerVector;
	}

	setControlPanelWidth(width: number): void {
		if ((this.controlPanelWidth.getValue() as IntegerVector).get(0) === width)
			return;
		const kw = KeywordIndex.formatIntegers(this.controlPanelWidth.getKeyword(), width);
		this.getJaamSimModel().storeAndExecute(new KeywordCommand(this, kw));
	}

	getControlPanelWidth(): number {
		return (this.controlPanelWidth.getValue() as IntegerVector).get(0);
	}

	isModelBuilderVisible(): boolean {
		return this.showModelBuilder.getValue() as boolean;
	}

	isObjectSelectorVisible(): boolean {
		return this.showObjectSelector.getValue() as boolean;
	}

	isInputEditorVisible(): boolean {
		return this.showInputEditor.getValue() as boolean;
	}

	isOutputViewerVisible(): boolean {
		return this.showOutputViewer.getValue() as boolean;
	}

	isPropertyViewerVisible(): boolean {
		return this.showPropertyViewer.getValue() as boolean;
	}

	isLogViewerVisible(): boolean {
		return this.showLogViewer.getValue() as boolean;
	}

	isEventViewerVisible(): boolean {
		return this.showEventViewer.getValue() as boolean;
	}

	static setDefaults(winDefs: WindowDefaults): void {
		Simulation.modelBuilderPosDef.set(0, winDefs.COL1_START);
		Simulation.modelBuilderPosDef.set(1, winDefs.TOP_START);

		Simulation.modelBuilderSizeDef.set(0, winDefs.COL1_WIDTH);
		Simulation.modelBuilderSizeDef.set(1, winDefs.HALF_TOP);

		Simulation.objectSelectorPosDef.set(0, winDefs.COL1_START);
		Simulation.objectSelectorPosDef.set(1, winDefs.BOTTOM_START);

		Simulation.objectSelectorSizeDef.set(0, winDefs.COL1_WIDTH);
		Simulation.objectSelectorSizeDef.set(1, winDefs.HALF_BOTTOM);

		Simulation.inputEditorPosDef.set(0, winDefs.COL2_START);
		Simulation.inputEditorPosDef.set(1, winDefs.LOWER_START);

		Simulation.inputEditorSizeDef.set(0, winDefs.COL2_WIDTH);
		Simulation.inputEditorSizeDef.set(1, winDefs.LOWER_HEIGHT);

		Simulation.outputViewerPosDef.set(0, winDefs.COL3_START);
		Simulation.outputViewerPosDef.set(1, winDefs.LOWER_START);

		Simulation.outputViewerSizeDef.set(0, winDefs.COL3_WIDTH);
		Simulation.outputViewerSizeDef.set(1, winDefs.LOWER_HEIGHT);

		Simulation.propertyViewerPosDef.set(0, winDefs.COL4_START);
		Simulation.propertyViewerPosDef.set(1, winDefs.LOWER_START);

		Simulation.propertyViewerSizeDef.set(0, winDefs.COL4_WIDTH);
		Simulation.propertyViewerSizeDef.set(1, winDefs.LOWER_HEIGHT);

		Simulation.logViewerPosDef.set(0, winDefs.COL4_START);
		Simulation.logViewerPosDef.set(1, winDefs.LOWER_START);

		Simulation.logViewerSizeDef.set(0, winDefs.COL4_WIDTH);
		Simulation.logViewerSizeDef.set(1, winDefs.LOWER_HEIGHT);

		Simulation.eventViewerPosDef.set(0, winDefs.COL4_START);
		Simulation.eventViewerPosDef.set(1, winDefs.LOWER_START);

		Simulation.eventViewerSizeDef.set(0, winDefs.COL4_WIDTH);
		Simulation.eventViewerSizeDef.set(1, winDefs.LOWER_HEIGHT);

		Simulation.controlPanelWidthDef.set(0, winDefs.DEFAULT_GUI_WIDTH);
	}

	getNumberOfReplications(): number {
		return toInt(this.numberOfReplications.getNextSample(this, 0.0));
	}

	getNumberOfThreads(): number {
		if (this.isRealTime())
			return 1;
		return Math.min(this.numberOfThreads.getValue() as number, this.getNumberOfRuns());
	}

	getPrintReplications(): boolean {
		return this.printReplications.getValue() as boolean;
	}

	getPrintConfidenceIntervals(): boolean {
		return this.printConfidenceIntervals.getValue() as boolean;
	}

	getPrintRunLabels(): boolean {
		return this.printRunLabels.getValue() as boolean;
	}

	getStartingScenarioNumber(): number {
		return toInt(this.startingScenarioNumber.getNextSample(this, 0.0));
	}

	getEndingScenarioNumber(): number {
		const ret = toInt(this.endingScenarioNumber.getNextSample(this, 0.0));
		return Math.max(ret, this.getStartingScenarioNumber());
	}

	getNumberOfScenarios(): number {
		return this.getEndingScenarioNumber() - this.getStartingScenarioNumber() + 1;
	}

	getNumberOfRuns(): number {
		return Math.imul(this.getNumberOfScenarios(), this.getNumberOfReplications());
	}

	getScenarioIndexDefinitionList(): IntegerVector {
		return this.scenarioIndexDefinitionList.getValue() as IntegerVector;
	}

	getSoftwareName(_simTime: number): string {
		return AboutBox.softwareName;
	}

	getSoftwareVersion(_simTime: number): string {
		return AboutBox.version;
	}

	getConfigFileName(_simTime: number): string {
		if (this.getJaamSimModel().getConfigFile() != null)
			return this.getJaamSimModel().getConfigFile()!;

		return "";
	}

	getScenarioNumber(_simTime: number): number {
		return this.getJaamSimModel().getScenarioNumber();
	}

	getScenarioIndex(_simTime: number): IntegerVector {
		return this.getJaamSimModel().getScenarioIndexList();
	}

	getReplicationNumber(_simTime: number): number {
		return this.getJaamSimModel().getReplicationNumber();
	}

	getRunNumber(_simTime: number): number {
		return this.getJaamSimModel().getRunNumber();
	}

	getRunIndex(_simTime: number): IntegerVector {
		return this.getJaamSimModel().getScenarioIndexList();
	}

	getPresentTime(_simTime: number): string {
		// Java: new SimpleDateFormat("MMM dd, yyyy HH:mm").format(今の時刻)（その地域の時刻）
		const d = new Date();
		const MMM = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
		const pad = (n: number) => String(n).padStart(2, "0");
		const timeStamp = `${MMM} ${pad(d.getDate())}, ${String(d.getFullYear()).padStart(4, "0")} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
		return timeStamp;
	}

	getPresentSimulationTime(simTime: number): number {
		return simTime;
	}

	getSimDate(simTime: number): number[] {
		const millis = this.getJaamSimModel().simTimeToCalendarMillis(simTime);
		return this.getJaamSimModel().getSimDate(millis).toArray();
	}

	getSimDayOfWeek(simTime: number): number {
		const millis = this.getJaamSimModel().simTimeToCalendarMillis(simTime);
		return this.getJaamSimModel().getDayOfWeek(millis);
	}

	getPresentDate(_simTime: number): number[] {
		// Java: new SimDate(Calendar.getInstance())（その地域の時刻）
		const d = new Date();
		const simDate = new SimDate(d.getFullYear(), d.getMonth() + 1, d.getDate(),
				d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
		return simDate.toArray();
	}

	getPresentDayOfWeek(_simTime: number): number {
		return new Date().getDay() + 1;
	}

	getPresentMilliseconds(_simTime: number): number {
		return Date.now()/1000.0;
	}

}

/** Java の Long.MAX_VALUE を double にした値（2^63） */
const JAVA_LONG_MAX_AS_DOUBLE = 9223372036854775807;

/** Java の (int) キャスト（NaN は 0、範囲外は端に張り付く） */
function toInt(x: number): number {
	if (Number.isNaN(x))
		return 0;
	if (x >= Integer.MAX_VALUE)
		return Integer.MAX_VALUE;
	if (x <= Integer.MIN_VALUE)
		return Integer.MIN_VALUE;
	return Math.trunc(x) | 0;
}

void Long; void jstr; void Calendar; void SimCalendar;  // import を残す（未使用の警告を避ける）

defineOutput(Simulation, {
	name: "SoftwareName",
	description: "The licensed name for the simulation software.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 0,
	returnType: "String",
	get: (e, simTime) => e.getSoftwareName(simTime),
});

defineOutput(Simulation, {
	name: "SoftwareVersion",
	description: "The release number for the simulation software.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 1,
	returnType: "String",
	get: (e, simTime) => e.getSoftwareVersion(simTime),
});

defineOutput(Simulation, {
	name: "ConfigurationFile",
	description: "The configuration file that has been loaded.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 2,
	returnType: "String",
	get: (e, simTime) => e.getConfigFileName(simTime),
});

defineOutput(Simulation, {
	name: "ScenarioNumber",
	description: "The counter used to identify an individual simulation scenario when multiple "
	           + "scenarios are being made.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 3,
	returnType: "int",
	get: (e, simTime) => e.getScenarioNumber(simTime),
});

defineOutput(Simulation, {
	name: "ScenarioIndex",
	description: "The list of scenario indices that correspond to the scenario number.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 4,
	returnType: "IntegerVector",
	get: (e, simTime) => e.getScenarioIndex(simTime),
});

defineOutput(Simulation, {
	name: "ReplicationNumber",
	description: "The counter used to identify an individual replication for the present "
	           + "scenario.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 5,
	returnType: "int",
	get: (e, simTime) => e.getReplicationNumber(simTime),
});

defineOutput(Simulation, {
	name: "RunNumber",
	description: "The counter used to identify an individual simulation run when multiple runs "
	           + "are being made.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 6,
	returnType: "int",
	get: (e, simTime) => e.getRunNumber(simTime),
});

defineOutput(Simulation, {
	name: "RunIndex",
	description: "For backwards compatibility - same as the ScenarioIndex output.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 7,
	returnType: "IntegerVector",
	get: (e, simTime) => e.getRunIndex(simTime),
});

defineOutput(Simulation, {
	name: "PresentTimeAndDate",
	description: "The present local time and date.",
	unitType: DimensionlessUnit,
	reportable: true,
	sequence: 8,
	returnType: "String",
	get: (e, simTime) => e.getPresentTime(simTime),
});

defineOutput(Simulation, {
	name: "PresentSimulationTime",
	description: "The value for the simulation clock at the present time.",
	unitType: TimeUnit,
	reportable: true,
	sequence: 9,
	returnType: "double",
	get: (e, simTime) => e.getPresentSimulationTime(simTime),
});

defineOutput(Simulation, {
	name: "SimDate",
	description: "The calendar date and time of day for the present simulation time expressed "
	           + "as an array of integer values in the format "
	           + "(YYYY, MM, DD, hh, mm, ss, milliseconds).",
	unitType: DimensionlessUnit,
	sequence: 10,
	returnType: "int[]",
	get: (e, simTime) => e.getSimDate(simTime),
});

defineOutput(Simulation, {
	name: "SimDayOfWeek",
	description: "The calendar day of week (Sunday = 1, Monday = 2, ..., Saturday = 7) for the "
	           + "present simulation time.",
	unitType: DimensionlessUnit,
	sequence: 11,
	returnType: "int",
	get: (e, simTime) => e.getSimDayOfWeek(simTime),
});

defineOutput(Simulation, {
	name: "PresentDate",
	description: "The present local calendar date and time of day expressed "
	           + "as an array of integer values in the format "
	           + "(YYYY, MM, DD, hh, mm, ss, milliseconds).",
	unitType: DimensionlessUnit,
	sequence: 12,
	returnType: "int[]",
	get: (e, simTime) => e.getPresentDate(simTime),
});

defineOutput(Simulation, {
	name: "PresentDayOfWeek",
	description: "The calendar day of week (Sunday = 1, Monday = 2, ..., Saturday = 7) for the "
	           + "present local time.",
	unitType: DimensionlessUnit,
	sequence: 13,
	returnType: "int",
	get: (e, simTime) => e.getPresentDayOfWeek(simTime),
});

defineOutput(Simulation, {
	name: "PresentTime",
	description: "The present elapsed time since the epoch (1970-01-01 00:00:00).",
	unitType: TimeUnit,
	sequence: 14,
	returnType: "double",
	get: (e, simTime) => e.getPresentMilliseconds(simTime),
});

ClassRegistry.register("com.jaamsim.basicsim.Simulation", Simulation);
