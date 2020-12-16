import { ExtensionContext } from "vscode";
import { Foam } from "./core/types";

export interface FoamFeature {
  activate: (context: ExtensionContext, foamPromise: Promise<Foam>) => void
}
