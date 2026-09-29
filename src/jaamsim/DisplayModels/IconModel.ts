/*
 * JaamSim Discrete Event Simulation
 * Copyright (C) 2018 JaamSim Software Inc.
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
import { LateClasses } from "../internal.ts";
import { ClassRegistry } from "../internal.ts";
import { ImageModel } from "../internal.ts";

/**
 * Provides a separate class for the ImageModels used for object icons. It allows the ImageModels
 * for icons to be separated from those for images imported by the user.
 * @author Harry King
 *
 */
export class IconModel extends ImageModel {}

ClassRegistry.register("com.jaamsim.DisplayModels.IconModel", IconModel);
LateClasses.bind("com.jaamsim.DisplayModels.IconModel", IconModel);
