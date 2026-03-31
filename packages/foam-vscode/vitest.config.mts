import { defineConfig } from 'vitest/config';
import path from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function findSpecFiles(dir: string, base = dir): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findSpecFiles(full, base));
    } else if (entry.endsWith('.spec.ts')) {
      results.push(path.relative(base, full));
    }
  }
  return results;
}

function getUnitReadySpecFiles(): string[] {
  const srcDir = path.join(__dirname, 'src');
  return findSpecFiles(srcDir)
    .filter(file => {
      const content = readFileSync(path.join(srcDir, file), 'utf8');
      return (
        content.includes('/* @unit-ready */') ||
        content.includes('// @unit-ready')
      );
    })
    .map(file => `src/${file}`);
}

const excludeSpecs = process.env.EXCLUDE_SPECS === 'true';
const unitReadySpecs = excludeSpecs ? [] : getUnitReadySpecFiles();

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.join(__dirname, 'src/test/vscode-mock.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [
      './src/test/support/vitest-setup.ts',
      './src/test/support/vitest-setup-after-env.ts',
    ],
    include: ['src/**/*.test.ts', ...unitReadySpecs],
    exclude: ['src/test/web/**', 'node_modules/**', '.vscode-test/**'],
    testTimeout: 20000,
    fileParallelism: false,
    clearMocks: true,
  },
});
