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

    await writeStarlightSite({
      artifactSet,
      outputDir: path.join(tmpDir, 'site'),
    });

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

  it('does not strip lines that start with # but are not headings', async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'foam-starlight-non-h1-'));

    const artifactSet: PublishArtifactSet = {
      site: { title: 'Site', description: '', homepageRoute: null },
      graph: { nodeInfo: {}, links: [] },
      notes: [
        {
          sourceUri: URI.file(path.join(tmpDir, 'shebang.md')),
          route: '/shebang',
          title: 'Shebang',
          description: '',
          properties: {},
          markdown: '#!/usr/bin/env bash\n\necho "hello"',
          backlinks: [],
        },
        {
          sourceUri: URI.file(path.join(tmpDir, 'include.md')),
          route: '/include',
          title: 'Include',
          description: '',
          properties: {},
          markdown: '#include <stdio.h>\n\nint main() {}',
          backlinks: [],
        },
      ],
      assets: [],
      routes: [
        {
          sourceUri: URI.file(path.join(tmpDir, 'shebang.md')),
          route: '/shebang',
        },
        {
          sourceUri: URI.file(path.join(tmpDir, 'include.md')),
          route: '/include',
        },
      ],
      diagnostics: [],
    };

    await writeStarlightSite({
      artifactSet,
      outputDir: path.join(tmpDir, 'site'),
    });

    const shebangContent = fs.readFileSync(
      path.join(tmpDir, 'site', 'src', 'content', 'docs', 'shebang.md'),
      'utf8'
    );
    expect(shebangContent).toContain('#!/usr/bin/env bash');

    const includeContent = fs.readFileSync(
      path.join(tmpDir, 'site', 'src', 'content', 'docs', 'include.md'),
      'utf8'
    );
    expect(includeContent).toContain('#include <stdio.h>');
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
          sourceUri: URI.file(
            path.join(tmpDir, 'my-folder', 'sub_dir', 'other.md')
          ),
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
        {
          sourceUri: URI.file(path.join(tmpDir, 'my-folder', 'note.md')),
          route: '/my-folder/note',
        },
        {
          sourceUri: URI.file(
            path.join(tmpDir, 'my-folder', 'sub_dir', 'other.md')
          ),
          route: '/my-folder/sub_dir/other',
        },
      ],
      diagnostics: [],
    };

    await writeStarlightSite({
      artifactSet,
      outputDir: path.join(tmpDir, 'site'),
    });

    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          'site',
          'src',
          'content',
          'docs',
          'my-folder',
          'note.md'
        )
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          'site',
          'src',
          'content',
          'docs',
          'my-folder',
          'sub_dir',
          'other.md'
        )
      )
    ).toBe(true);
  });

  it('strips YAML frontmatter from note markdown to avoid double rendering', async () => {
    const tmpDir = mkdtempSync(
      path.join(tmpdir(), 'foam-starlight-frontmatter-')
    );

    const artifactSet: PublishArtifactSet = {
      site: { title: 'Site', description: '', homepageRoute: null },
      graph: { nodeInfo: {}, links: [] },
      notes: [
        {
          sourceUri: URI.file(path.join(tmpDir, 'note.md')),
          route: '/note',
          title: 'My Note',
          description: '',
          properties: { author: 'Alice', status: 'draft' },
          markdown:
            '---\ntitle: My Note\nauthor: Alice\nstatus: draft\n---\n\n# My Note\n\nBody content.',
          backlinks: [],
        },
      ],
      assets: [],
      routes: [
        { sourceUri: URI.file(path.join(tmpDir, 'note.md')), route: '/note' },
      ],
      diagnostics: [],
    };

    await writeStarlightSite({
      artifactSet,
      outputDir: path.join(tmpDir, 'site'),
    });

    const content = fs.readFileSync(
      path.join(tmpDir, 'site', 'src', 'content', 'docs', 'note.md'),
      'utf8'
    );
    // The original YAML block must not appear in the body
    expect(content).not.toMatch(/^---[\s\S]*?author: Alice[\s\S]*?---/m);
    expect(content).toContain('Body content.');
  });

  it('renders note properties after the title, skipping title and description', async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'foam-starlight-props-'));

    const artifactSet: PublishArtifactSet = {
      site: { title: 'Site', description: '', homepageRoute: null },
      graph: { nodeInfo: {}, links: [] },
      notes: [
        {
          sourceUri: URI.file(path.join(tmpDir, 'note.md')),
          route: '/note',
          title: 'My Note',
          description: 'A note',
          properties: {
            title: 'My Note',
            description: 'A note',
            author: 'Alice',
            tags: ['foam', 'notes'],
            status: 'draft',
          },
          markdown: '# My Note\n\nSome content here.',
          backlinks: [],
        },
        {
          sourceUri: URI.file(path.join(tmpDir, 'empty-props.md')),
          route: '/empty-props',
          title: 'Empty',
          description: '',
          properties: {},
          markdown: 'No properties.',
          backlinks: [],
        },
      ],
      assets: [],
      routes: [
        { sourceUri: URI.file(path.join(tmpDir, 'note.md')), route: '/note' },
        {
          sourceUri: URI.file(path.join(tmpDir, 'empty-props.md')),
          route: '/empty-props',
        },
      ],
      diagnostics: [],
    };

    await writeStarlightSite({
      artifactSet,
      outputDir: path.join(tmpDir, 'site'),
    });

    const noteContent = fs.readFileSync(
      path.join(tmpDir, 'site', 'src', 'content', 'docs', 'note.md'),
      'utf8'
    );
    // Properties section should be rendered
    expect(noteContent).toContain('class="note-properties"');
    // title and description are excluded
    expect(noteContent).not.toMatch(/note-property-key[^>]*>title</);
    expect(noteContent).not.toMatch(/note-property-key[^>]*>description</);
    // Other properties are included
    expect(noteContent).toContain('>author<');
    expect(noteContent).toContain('>Alice<');
    expect(noteContent).toContain('>status<');
    expect(noteContent).toContain('>draft<');
    // Array values are rendered as chips
    expect(noteContent).toContain('class="note-property-chip"');
    expect(noteContent).toContain('>foam<');
    expect(noteContent).toContain('>notes<');
    // Properties section appears before the body content
    const propertiesIndex = noteContent.indexOf('note-properties');
    const bodyIndex = noteContent.indexOf('Some content here.');
    expect(propertiesIndex).toBeLessThan(bodyIndex);

    // Notes with no non-excluded properties have no properties section
    const emptyContent = fs.readFileSync(
      path.join(tmpDir, 'site', 'src', 'content', 'docs', 'empty-props.md'),
      'utf8'
    );
    expect(emptyContent).not.toContain('note-properties');
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

    const graphBundlePath = path.join(tmpDir, 'foam-graph.standalone.js');
    fs.writeFileSync(graphBundlePath, '/* foam-graph standalone bundle */');

    await writeStarlightSite({
      artifactSet,
      outputDir: path.join(tmpDir, 'site'),
      siteUrl: 'https://example.com',
      graphBundlePath,
    });

    expect(
      fs.readFileSync(path.join(tmpDir, 'site', 'package.json'), 'utf8')
    ).toContain('"@astrojs/starlight"');
    expect(
      fs.readFileSync(path.join(tmpDir, 'site', 'package.json'), 'utf8')
    ).not.toContain('"@foam/graph"');
    expect(
      fs.readFileSync(path.join(tmpDir, 'site', 'astro.config.mjs'), 'utf8')
    ).toContain('site: siteConfig.siteUrl');
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
    const pageSidebar = fs.readFileSync(
      path.join(tmpDir, 'site', 'src', 'components', 'FoamPageSidebar.astro'),
      'utf8'
    );
    // expect(pageSidebar).toContain("import '../lib/foam-graph.js';");
    // expect(pageSidebar).toContain('<foam-graph');
    expect(pageSidebar).toContain('class="foam-sidebar-graph"');
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
    expect(
      fs.readFileSync(
        path.join(tmpDir, 'site', 'src', 'lib', 'foam-graph.js'),
        'utf8'
      )
    ).toBe('/* foam-graph standalone bundle */');
  });
});
