//@@HEADER@@
import { LateClasses } from "../Graphics/LateClasses.ts";
import { ClassRegistry } from "../java/ClassRegistry.ts";
import { ImageModel } from "./ImageModel.ts";

/**
 * Provides a separate class for the ImageModels used for object icons. It allows the ImageModels
 * for icons to be separated from those for images imported by the user.
 * @author Harry King
 *
 */
export class IconModel extends ImageModel {}

ClassRegistry.register("com.jaamsim.DisplayModels.IconModel", IconModel);
LateClasses.bind("com.jaamsim.DisplayModels.IconModel", IconModel);
