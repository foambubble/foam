import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { runCli } from './index';
import { TestLogger } from './test/test-utils';

describe('foam CLI', () => {
  it('exports a content-rooted workspace to a runnable Starlight site', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'foam-cli-'));
    const workspaceDir = path.join(tempRoot, 'workspace');
    const outputDir = path.join(tempRoot, 'site');

    try {
      fs.mkdirSync(path.join(workspaceDir, 'user'), { recursive: true });
      fs.mkdirSync(path.join(workspaceDir, 'dev'), { recursive: true });
      fs.mkdirSync(path.join(workspaceDir, 'files'), { recursive: true });
      fs.mkdirSync(path.join(workspaceDir, 'private'), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'user', 'index.md'),
        ['# Home', '', '[Manual](../files/manual.pdf)'].join('\n'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(workspaceDir, 'dev', 'internal.md'),
        '# Internal',
        'utf8'
      );
      fs.writeFileSync(
        path.join(workspaceDir, 'files', 'manual.pdf'),
        'pdf',
        'utf8'
      );
      fs.writeFileSync(
        path.join(workspaceDir, 'private', 'secret.pdf'),
        'secret',
        'utf8'
      );

      const logger = new TestLogger();

      const exitCode = await runCli(
        [
          'export',
          workspaceDir,
          '--target',
          'starlight',
          '--out',
          outputDir,
          '--title',
          'CLI Site',
          '--content-root',
          'user',
          '--site-url',
          'https://example.com',
        ],
        logger
      );

      expect(exitCode).toBe(0);
      expect(logger.errors).toEqual([]);
      expect(
        fs.existsSync(path.join(outputDir, 'src', 'content', 'docs', 'index.md'))
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(outputDir, 'src', 'content', 'docs', 'dev', 'internal.md')
        )
      ).toBe(false);
      expect(
        fs.existsSync(
          path.join(outputDir, 'public', 'assets', 'private', 'secret.pdf')
        )
      ).toBe(false);
      expect(
        fs.readFileSync(
          path.join(outputDir, 'public', 'assets', 'files', 'manual.pdf'),
          'utf8'
        )
      ).toBe('pdf');
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(outputDir, 'generated', 'site-config.json'),
            'utf8'
          )
        )
      ).toEqual({
        title: 'CLI Site',
        description: 'Exported from a Foam knowledge base.',
        homepageRoute: '/',
        siteUrl: 'https://example.com',
      });
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(outputDir, 'public', 'export-routes.json'),
            'utf8'
          )
        )
      ).toEqual([
        {
          sourcePath: path.join(workspaceDir, 'user', 'index.md'),
          route: '/',
        },
      ]);
      expect(logger.logs).toEqual([]);
      expect(
        fs.readFileSync(path.join(outputDir, 'package.json'), 'utf8')
      ).toContain('"@astrojs/starlight"');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('accepts the deprecated `publish` alias and warns', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'foam-cli-'));
    const workspaceDir = path.join(tempRoot, 'workspace');
    const outputDir = path.join(tempRoot, 'site');

    try {
      fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'index.md'),
        '# Home',
        'utf8'
      );

      const logger = new TestLogger();
      const exitCode = await runCli(
        ['publish', workspaceDir, '--out', outputDir, '--target', 'starlight'],
        logger
      );

      expect(exitCode).toBe(0);
      expect(logger.warnings.join('\n')).toContain(
        '`foam publish` has been renamed to `foam export`'
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
