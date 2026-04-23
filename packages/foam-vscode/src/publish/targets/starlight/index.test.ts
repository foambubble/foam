import fs from 'fs';
import { mkdtempSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { URI } from '../../../core/model/uri';
import { PublishArtifactSet } from '../../types';
import { writeStarlightSite } from './index';

describe('publish starlight target', () => {
  it('strips leading h1 from note markdown to avoid duplicate title', async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'foam-starlight-strip-h1-'));

    const artifactSet: PublishArtifactSet = {
      site: { title: 'Site', description: '', homepageRoute: null },
      graph: { nodeInfo: {}, links: [] },
      notes: [
        {
          sourceUri: URI.file(path.join(tmpDir, 'note.md')),
          route: '/note',
          title: 'My Note',
          description: '',
          properties: {},
          markdown: '# My Note\n\nSome content here.',
          backlinks: [],
        },
        {
          sourceUri: URI.file(path.join(tmpDir, 'other.md')),
          route: '/other',
          title: 'Other',
          description: '',
          properties: {},
          markdown: '## Not a top-level h1\n\nContent.',
          backlinks: [],
        },
      ],
      assets: [],
      routes: [
        { sourceUri: URI.file(path.join(tmpDir, 'note.md')), route: '/note' },
        { sourceUri: URI.file(path.join(tmpDir, 'other.md')), route: '/other' },
      ],
      diagnostics: [],
    };

    await writeStarlightSite({ artifactSet, outputDir: path.join(tmpDir, 'site') });

    const noteContent = fs.readFileSync(
      path.join(tmpDir, 'site', 'src', 'content', 'docs', 'note.md'),
      'utf8'
    );
    // H1 should be stripped; body content should remain
    expect(noteContent).not.toContain('# My Note');
    expect(noteContent).toContain('Some content here.');

    const otherContent = fs.readFileSync(
      path.join(tmpDir, 'site', 'src', 'content', 'docs', 'other.md'),
      'utf8'
    );
    // H2 should not be stripped
    expect(otherContent).toContain('## Not a top-level h1');
  });

  it('writes nested notes into correct folder structure', async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'foam-starlight-nested-'));

    const artifactSet: PublishArtifactSet = {
      site: { title: 'Site', description: '', homepageRoute: null },
      graph: { nodeInfo: {}, links: [] },
      notes: [
        {
          sourceUri: URI.file(path.join(tmpDir, 'my-folder', 'note.md')),
          route: '/my-folder/note',
          title: 'Note',
          description: '',
          properties: {},
          markdown: 'Content.',
          backlinks: [],
        },
        {
          sourceUri: URI.file(path.join(tmpDir, 'my-folder', 'sub_dir', 'other.md')),
          route: '/my-folder/sub_dir/other',
          title: 'Other',
          description: '',
          properties: {},
          markdown: 'Content.',
          backlinks: [],
        },
      ],
      assets: [],
      routes: [
        { sourceUri: URI.file(path.join(tmpDir, 'my-folder', 'note.md')), route: '/my-folder/note' },
        { sourceUri: URI.file(path.join(tmpDir, 'my-folder', 'sub_dir', 'other.md')), route: '/my-folder/sub_dir/other' },
      ],
      diagnostics: [],
    };

    await writeStarlightSite({ artifactSet, outputDir: path.join(tmpDir, 'site') });

    expect(fs.existsSync(
      path.join(tmpDir, 'site', 'src', 'content', 'docs', 'my-folder', 'note.md')
    )).toBe(true);
    expect(fs.existsSync(
      path.join(tmpDir, 'site', 'src', 'content', 'docs', 'my-folder', 'sub_dir', 'other.md')
    )).toBe(true);
  });

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
      graph: {
        nodeInfo: {
          '/guide': {
            id: '/guide',
            type: 'note',
            title: 'Guide',
            properties: {},
            tags: [],
          },
          '/linked': {
            id: '/linked',
            type: 'note',
            title: 'Linked',
            properties: {},
            tags: [],
          },
        },
        links: [{ source: '/guide', target: '/linked' }],
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
      diagnostics: [],
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
      fs.readFileSync(path.join(tmpDir, 'site', 'package.json'), 'utf8')
    ).toContain('"@foam/graph"');
    expect(
      fs.readFileSync(path.join(tmpDir, 'site', 'astro.config.mjs'), 'utf8')
    ).toContain("site: siteConfig.siteUrl");
    expect(
      fs.readFileSync(path.join(tmpDir, 'site', 'astro.config.mjs'), 'utf8')
    ).toContain("Footer: './src/components/FoamFooter.astro'");
    expect(
      fs.readFileSync(path.join(tmpDir, 'site', 'astro.config.mjs'), 'utf8')
    ).toContain("PageSidebar: './src/components/FoamPageSidebar.astro'");
    expect(
      fs.readFileSync(
        path.join(tmpDir, 'site', 'src', 'components', 'FoamFooter.astro'),
        'utf8'
      )
    ).toContain('Published with <a href="https://foamnotes.com">Foam</a>');
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
    ).toContain('<div class="backlinks">');
    expect(
      fs.readFileSync(
        path.join(tmpDir, 'site', 'src', 'components', 'FoamPageSidebar.astro'),
        'utf8'
      )
    ).toContain("import '@foam/graph';");
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
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(tmpDir, 'site', 'public', 'foam-graph.json'),
          'utf8'
        )
      )
    ).toEqual(artifactSet.graph);
  });
});
