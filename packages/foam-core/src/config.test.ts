import { describe, expect, it } from 'vitest';
import {
  DefaultFoamConfig,
  IFoamConfigSource,
  cascadeFoamConfig,
} from './config';

describe('cascadeFoamConfig', () => {
  it('falls back to defaults when no source has an opinion', () => {
    const config = cascadeFoamConfig([], new DefaultFoamConfig());

    expect(config.getCompletionLinkFormat()).toBe('wikilink');
    expect(config.getTelemetryEnabled()).toBe(true);
    expect(config.getFilesInclude()).toEqual(['**/*']);
  });

  it('uses the value from the highest-priority source that has an opinion', () => {
    const userSource: IFoamConfigSource = {
      getCompletionLinkFormat: () => 'link',
    };
    const workspaceSource: IFoamConfigSource = {
      getCompletionLinkFormat: () => 'wikilink',
      getTelemetryEnabled: () => false,
    };

    const config = cascadeFoamConfig(
      [workspaceSource, userSource],
      new DefaultFoamConfig()
    );

    // workspace wins for keys it defines
    expect(config.getCompletionLinkFormat()).toBe('wikilink');
    expect(config.getTelemetryEnabled()).toBe(false);
  });

  it('skips a source whose getter returns undefined and tries the next', () => {
    const partialUser: IFoamConfigSource = {
      // Explicitly defined but returns undefined — should be skipped.
      getTelemetryEnabled: () => undefined as unknown as boolean,
    };
    const workspaceSource: IFoamConfigSource = {
      getTelemetryEnabled: () => false,
    };

    const config = cascadeFoamConfig(
      [partialUser, workspaceSource],
      new DefaultFoamConfig()
    );

    expect(config.getTelemetryEnabled()).toBe(false);
  });

  it('falls through past every partial source to the fallback', () => {
    const partialA: IFoamConfigSource = { getDateLocale: () => 'fr-FR' };
    const partialB: IFoamConfigSource = { getTemplatesFolder: () => '.tpl' };

    const config = cascadeFoamConfig(
      [partialA, partialB],
      new DefaultFoamConfig()
    );

    // Neither partial source set this — defaults win.
    expect(config.getCompletionLinkFormat()).toBe('wikilink');
    // Each partial source's contribution still resolves correctly.
    expect(config.getDateLocale()).toBe('fr-FR');
    expect(config.getTemplatesFolder()).toBe('.tpl');
  });

  it('treats a fully-resolved IFoamConfig as just another source', () => {
    // Passing an existing IFoamConfig (e.g. another DefaultFoamConfig)
    // as a source should work — every getter is defined.
    const defaults = new DefaultFoamConfig();
    const override: IFoamConfigSource = { getTelemetryEnabled: () => false };

    const config = cascadeFoamConfig([override, defaults], new DefaultFoamConfig());

    expect(config.getTelemetryEnabled()).toBe(false);
    expect(config.getCompletionLinkFormat()).toBe('wikilink');
  });
});

describe('DefaultFoamConfig', () => {
  it('provides getTelemetryEnabled defaulting to true', () => {
    expect(new DefaultFoamConfig().getTelemetryEnabled()).toBe(true);
  });
});
