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
