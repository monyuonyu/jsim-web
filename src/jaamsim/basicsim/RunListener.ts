import type { JaamSimModel } from "./JaamSimModel.ts";

export interface RunListener {

	/**
	 * Notifies that the specified simulation run has finished execution.
	 * @param run - simulation run that has been completed
	 */
	runEnded(): void;

	/**
	 * Called when a runtime error is encountered during the model run. An EventManager context is available
	 * as this will always be called from a model process.
	 * @param sm - the model where the error was encountered
	 * @param t - error condition
	 */
	handleRuntimeError(sm: JaamSimModel, t: unknown): void;

}
