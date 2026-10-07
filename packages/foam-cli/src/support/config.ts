import fs from 'node:fs';
import path from 'node:path';
import { IFoamConfig, foamConfigFromVsCodeSettings } from '@foam/core';

export function readFoamConfig(workspaceDir: string): IFoamConfig {
  const settingsPath = path.join(workspaceDir, '.vscode', 'settings.json');
  let text: string | null = null;

  try {
    text = fs.readFileSync(settingsPath, 'utf8');
  } catch (e) {
    // ENOENT is expected when the workspace has no .vscode/settings.json — use defaults.
    // Any other error (permissions, I/O) is unexpected and should propagate.
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }

  return foamConfigFromVsCodeSettings(text);
}
