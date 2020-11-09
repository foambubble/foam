import createReferences from "./wikilink-reference-generation";
import openDailyNote from "./open-daily-note";
import janitor from "./janitor";
import dataviz from "./dataviz";
import copyWithoutBrackets from "./copy-without-brackets";
import openDatedNote from "./open-dated-note";
import tagsExplorer from "./tags-tree-view";
import createFromTemplate from "./create-from-template";
import { FoamFeature } from "../types";

export const features: FoamFeature[] = [
  tagsExplorer,
  createReferences,
  openDailyNote,
  janitor,
  dataviz,
  copyWithoutBrackets,
  openDatedNote,
  createFromTemplate
];
