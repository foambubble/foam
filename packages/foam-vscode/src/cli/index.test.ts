import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { runCli } from './index';

describe('foam CLI', () => {
  it('publishes a workspace to a runnable Starlight site', async () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'foam-cli-'));
    const workspaceDir = path.join(tempRoot, 'workspace');
    const outputDir = path.join(tempRoot, 'site');

    try {
      fs.mkdirSync(path.join(workspaceDir, 'images'), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'index.md'),
        ['# Home', '', '![Logo](./images/logo.png)'].join('\n'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(workspaceDir, 'draft.md'),
        ['---', 'publish: false', '---', '', '# Draft'].join('\n'),
        'utf8'
      );
      fs.writeFileSync(path.join(workspaceDir, 'images', 'logo.png'), 'png', 'utf8');

      const logs: string[] = [];
      const errors: string[] = [];

      const exitCode = await runCli(
        [
          'publish',
          workspaceDir,
          '--target',
          'starlight',
          '--out',
          outputDir,
          '--title',
          'CLI Site',
          '--site-url',
          'https://example.com',
        ],
        {
          log: value => logs.push(String(value)),
          error: value => errors.push(String(value)),
        }
      );

      expect(exitCode).toBe(0);
      expect(errors).toEqual([]);
      expect(
        fs.existsSync(path.join(outputDir, 'src', 'content', 'docs', 'index.md'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(outputDir, 'src', 'content', 'docs', 'draft.md'))
      ).toBe(false);
      expect(
        fs.readFileSync(
          path.join(outputDir, 'public', 'assets', 'images', 'logo.png'),
          'utf8'
        )
      ).toBe('png');
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(outputDir, 'generated', 'site-config.json'),
            'utf8'
          )
        )
      ).toEqual({
        title: 'CLI Site',
        description: 'Published from a Foam knowledge base.',
        homepageRoute: '/',
        siteUrl: 'https://example.com',
      });
      expect(logs).toEqual([]);
      expect(
        fs.readFileSync(path.join(outputDir, 'package.json'), 'utf8')
      ).toContain('"@astrojs/starlight"');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
