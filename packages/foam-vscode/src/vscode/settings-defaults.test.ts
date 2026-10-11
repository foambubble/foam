import fs from 'node:fs';
import path from 'node:path';
import { IFoamConfig, foamConfigFromVsCodeSettings } from '@foam/core';

/** Each setting's default, as this extension's package.json declares it. */
function declaredDefaults(): Record<string, unknown> {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
  );
  const sections: { properties?: Record<string, { default?: unknown }> }[] = [
    pkg.contributes.configuration,
  ].flat();
  return Object.fromEntries(
    sections
      .flatMap(section => Object.entries(section.properties ?? {}))
      .filter(([, property]) => 'default' in property)
      .map(([key, property]) => [key, property.default])
  );
}

/** What `config` answers to each of its getters. */
function answers(config: IFoamConfig): Record<string, unknown> {
  const getters = Object.getOwnPropertyNames(
    Object.getPrototypeOf(config)
  ).filter(name => name.startsWith('get'));
  return Object.fromEntries(
    getters.map(name => [
      name,
      (config as unknown as Record<string, () => unknown>)[name](),
    ])
  );
}

describe('the settings the CLI and the app read', () => {
  it('default to what desktop declares', () => {
    expect(answers(foamConfigFromVsCodeSettings({}))).toEqual(
      answers(foamConfigFromVsCodeSettings(declaredDefaults()))
    );
  });
});
