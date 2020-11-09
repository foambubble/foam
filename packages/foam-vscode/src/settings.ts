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

export function getIgnoredFilesSetting(): string[] {
  return workspace.getConfiguration("foam.files").get("ignore")
}

export function getTitleMaxLength(): number {
  return workspace.getConfiguration("foam.graph").get("titleMaxLength")
}