import path from 'path';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import type { TestProject } from 'vitest/node' with { 'resolution-mode': 'import' };
import {
  VSCODE_TEST_VERSION,
  getVSCodePlatform,
} from '../support/vscode-version';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The VS Code executable UI tests launch. */
    vscodeExecutable: string;
    /** This package's root, passed as `--extensionDevelopmentPath`. */
    extensionDevelopmentPath: string;
    /** Where screenshots go, one folder per test. */
    uiTestResultsDir: string;
  }
}

export default async function setup(project: TestProject) {
  const root = project.config.root;
  const executable = await downloadAndUnzipVSCode({
    version: VSCODE_TEST_VERSION,
    platform: getVSCodePlatform(),
    cachePath: path.join(root, '.vscode-test'),
  });

  project.provide('vscodeExecutable', executable);
  project.provide('extensionDevelopmentPath', root);
  project.provide(
    'uiTestResultsDir',
    path.join(root, 'out', 'ui-test-results')
  );
}
