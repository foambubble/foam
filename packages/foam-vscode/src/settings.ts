import { workspace } from 'vscode';

export enum LinkReferenceDefinitionsSetting {
  withExtensions = "withExtensions",
  withoutExtensions = "withoutExtensions"
};

export function includeExtensions() {
  const linkDefinitionSetting: LinkReferenceDefinitionsSetting =
  workspace
    .getConfiguration("foam.edit")
    .get<LinkReferenceDefinitionsSetting>("linkReferenceDefinitions") ??
  LinkReferenceDefinitionsSetting.withoutExtensions;

  return linkDefinitionSetting === LinkReferenceDefinitionsSetting.withExtensions;
}

  