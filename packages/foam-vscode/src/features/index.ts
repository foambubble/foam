import createReferences from "./wikilink-reference-generation";
import openDailyNote from "./open-daily-note";
import janitor from "./janitor";
import { FoamFeature } from "../types";

export const features: FoamFeature[] = [createReferences, openDailyNote, janitor];
