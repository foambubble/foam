import fs from 'fs';
import { mkdtempSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { URI } from '../../../core/model/uri';
import { PublishArtifactSet } from '../../types';
import { writeStarlightSite } from './index';

describe('publish starlight target', () => {
  it('writes a runnable Starlight project from publish artifacts', async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'foam-starlight-target-'));
    const assetSourcePath = path.join(tmpDir, 'fixtures', 'image.png');
    fs.mkdirSync(path.dirname(assetSourcePath), { recursive: true });
    fs.writeFileSync(assetSourcePath, 'asset-content', 'utf8');

    const artifactSet: PublishArtifactSet = {
      site: {
        title: 'Published Notes',
        description: 'A generated site',
        homepageRoute: '/guide',
      },
      notes: [
        {
          sourceUri: URI.file(path.join(tmpDir, 'guide.md')),
          route: '/guide',
          title: 'Guide',
          description: 'Start here',
          properties: {},
          markdown: '![Image](../assets/image.png)',
          backlinks: [],
        },
        {
          sourceUri: URI.file(path.join(tmpDir, '404.md')),
          route: '/404',
          title: 'Not Found',
          description: 'Ignored',
          properties: {},
          markdown: '# Missing',
          backlinks: [],
        },
        {
          sourceUri: URI.file(path.join(tmpDir, 'linked.md')),
          route: '/linked',
          title: 'Linked',
          description: 'Has backlinks',
          properties: {},
          markdown: '# Linked',
          backlinks: [
            {
              route: '/guide',
              title: 'Guide',
              sourceUri: URI.file(path.join(tmpDir, 'guide.md')),
            },
          ],
        },
      ],
      assets: [
        {
          sourceUri: URI.file(assetSourcePath),
          outputPath: 'assets/image.png',
        },
      ],
      routes: [
        {
          sourceUri: URI.file(path.join(tmpDir, 'guide.md')),
          route: '/guide',
        },
        {
          sourceUri: URI.file(path.join(tmpDir, '404.md')),
          route: '/404',
        },
        {
          sourceUri: URI.file(path.join(tmpDir, 'linked.md')),
          route: '/linked',
        },
      ],
    };

    await writeStarlightSite({
      artifactSet,
      outputDir: path.join(tmpDir, 'site'),
      siteUrl: 'https://example.com',
    });

    expect(
      fs.readFileSync(path.join(tmpDir, 'site', 'package.json'), 'utf8')
    ).toContain('"@astrojs/starlight"');
    expect(
      fs.readFileSync(path.join(tmpDir, 'site', 'astro.config.mjs'), 'utf8')
    ).toContain("site: siteConfig.siteUrl");
    expect(
      fs.readFileSync(
        path.join(tmpDir, 'site', 'src', 'content', 'docs', 'index.md'),
        'utf8'
      )
    ).toContain('](/assets/image.png)');
    expect(
      fs.readFileSync(
        path.join(tmpDir, 'site', 'src', 'content', 'docs', 'linked.md'),
        'utf8'
      )
    ).toContain('## Backlinks');
    expect(
      fs.existsSync(
        path.join(tmpDir, 'site', 'src', 'content', 'docs', '404.md')
      )
    ).toBe(false);
    expect(
      fs.readFileSync(
        path.join(tmpDir, 'site', 'public', 'assets', 'image.png'),
        'utf8'
      )
    ).toBe('asset-content');
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(tmpDir, 'site', 'generated', 'site-config.json'),
          'utf8'
        )
      )
    ).toEqual({
      title: 'Published Notes',
      description: 'A generated site',
      homepageRoute: '/guide',
      siteUrl: 'https://example.com',
    });
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(tmpDir, 'site', 'public', 'publish-routes.json'),
          'utf8'
        )
      )
    ).toEqual([
      {
        sourcePath: URI.file(path.join(tmpDir, 'guide.md')).path,
        route: '/guide',
      },
      {
        sourcePath: URI.file(path.join(tmpDir, 'linked.md')).path,
        route: '/linked',
      },
    ]);
  });
});
