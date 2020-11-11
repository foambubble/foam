import { workspace } from "vscode";

export enum LinkReferenceDefinitionsSetting {
  withExtensions = "withExtensions",
  withoutExtensions = "withoutExtensions",
  off = "off"
}

export function getWikilinkDefinitionSetting(): LinkReferenceDefinitionsSetting {
  return workspace
    .getConfiguration("foam.edit")
    .get<LinkReferenceDefinitionsSetting>(
      "linkReferenceDefinitions",
      LinkReferenceDefinitionsSetting.withoutExtensions
    );
}

/** Retrieve the list of file ignoring globs. */
export function getIgnoredFilesSetting(): string[] {
  return workspace.getConfiguration("foam.files").get("ignore")
}

/** Retrieves the maximum length for a Graph node title. */
export function getTitleMaxLength(): number {
  return workspace.getConfiguration("foam.graph").get("titleMaxLength")
}