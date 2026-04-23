import fs from 'node:fs/promises';
import path from 'node:path';

import { PublishArtifactSet } from '../../types';
import { STARLIGHT_TEMPLATE_FILES } from './template';

const DEFAULT_TITLE = 'Foam Site';
const DEFAULT_DESCRIPTION = 'Published from a Foam knowledge base.';

const DOCS_DIR = path.join('src', 'content', 'docs');
const PUBLIC_DIR = 'public';
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');
const GRAPH_DATA_PATH = path.join(PUBLIC_DIR, 'foam-graph.json');
const GENERATED_DIR = 'generated';
const ROUTES_MANIFEST_PATH = path.join(PUBLIC_DIR, 'publish-routes.json');

export interface StarlightTargetOptions {
  artifactSet: PublishArtifactSet;
  outputDir: string;
  includeProjectScaffold?: boolean;
  siteUrl?: string;
}

function routeToDocPath(route: string) {
  if (route === '/') {
    return 'index.md';
  }

  return `${route.replace(/^\/+/, '')}.md`;
}

function stripLeadingH1(markdown: string) {
  return markdown.replace(/^#[^#][^\n]*\n?/, '').replace(/^\n+/, '');
}

function escapeFrontmatter(value: string) {
  return value.replace(/"/g, '\\"');
}

function renderFrontmatter(note: PublishArtifactSet['notes'][number]) {
  const lines = [
    '---',
    `title: "${escapeFrontmatter(note.title)}"`,
    `description: "${escapeFrontmatter(
      note.description ?? `Published from ${note.sourceUri.path}`
    )}"`,
  ];

  lines.push('---', '');
  return lines.join('\n');
}

function renderBacklinks(
  backlinks: PublishArtifactSet['notes'][number]['backlinks']
) {
  if (backlinks.length === 0) {
    return '';
  }

  const items = backlinks
    .map(link => `  <a href="${link.route}">${link.title}</a>`)
    .join('\n');
  return `\n\n<div class="backlinks">\n<p class="backlinks-label">LINKS TO THIS PAGE</p>\n${items}\n</div>\n`;
}

function rewriteStaticAssetPaths(markdown: string) {
  return markdown
    .replace(/\]\(((?:\.\.\/)*assets\/[^)]+)\)/g, (_match, assetPath) => {
      return `](/${String(assetPath).replace(/^(?:\.\.\/)+/, '')})`;
    })
    .replace(
      /(src|href)="((?:\.\.\/)*assets\/)/g,
      (_match, attr, assetPath) => {
        return `${attr}="/${String(assetPath).replace(/^(?:\.\.\/)+/, '')}`;
      }
    );
}

function isFrameworkHandledRoute(route: string) {
  return route === '/404';
}

async function ensureCleanDir(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function writeTemplateFiles(outputDir: string) {
  await Promise.all(
    Object.entries(STARLIGHT_TEMPLATE_FILES).map(
      async ([relativePath, content]) => {
        const outputPath = path.join(outputDir, relativePath);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, content, 'utf8');
      }
    )
  );
}

async function writeDocs(outputDir: string, artifactSet: PublishArtifactSet) {
  const docsDir = path.join(outputDir, DOCS_DIR);

  for (const note of artifactSet.notes) {
    if (isFrameworkHandledRoute(note.route)) {
      continue;
    }

    if (
      artifactSet.site.homepageRoute &&
      artifactSet.site.homepageRoute !== '/' &&
      note.route === '/'
    ) {
      continue;
    }

    const relativePath = routeToDocPath(note.route);
    const outputPath = path.join(docsDir, relativePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      `${renderFrontmatter(note)}${rewriteStaticAssetPaths(
        stripLeadingH1(note.markdown)
      )}${renderBacklinks(note.backlinks)}`,
      'utf8'
    );
  }

  if (
    artifactSet.site.homepageRoute &&
    artifactSet.site.homepageRoute !== '/'
  ) {
    const homepageNote = artifactSet.notes.find(
      note => note.route === artifactSet.site.homepageRoute
    );

    if (homepageNote) {
      const outputPath = path.join(docsDir, 'index.md');
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(
        outputPath,
        `${renderFrontmatter(homepageNote)}${rewriteStaticAssetPaths(
          stripLeadingH1(homepageNote.markdown)
        )}${renderBacklinks(homepageNote.backlinks)}`,
        'utf8'
      );
    }
  }
}

async function copyAssets(outputDir: string, artifactSet: PublishArtifactSet) {
  const assetsDir = path.join(outputDir, ASSETS_DIR);

  for (const asset of artifactSet.assets) {
    const relativeOutput = asset.outputPath.replace(/^assets\//, '');
    const outputPath = path.join(assetsDir, relativeOutput);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(asset.sourceUri.toFsPath(), outputPath);
  }
}

async function writeSiteConfig(
  outputDir: string,
  artifactSet: PublishArtifactSet,
  siteUrl?: string
) {
  const outputPath = path.join(outputDir, GENERATED_DIR, 'site-config.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        title: artifactSet.site.title ?? DEFAULT_TITLE,
        description: artifactSet.site.description ?? DEFAULT_DESCRIPTION,
        homepageRoute: artifactSet.site.homepageRoute,
        siteUrl,
      },
      null,
      2
    ),
    'utf8'
  );
}

async function writeRoutesManifest(
  outputDir: string,
  artifactSet: PublishArtifactSet
) {
  const outputPath = path.join(outputDir, ROUTES_MANIFEST_PATH);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      artifactSet.routes
        .filter(route => !isFrameworkHandledRoute(route.route))
        .map(route => ({
          sourcePath: route.sourceUri.path,
          route: route.route,
        })),
      null,
      2
    ),
    'utf8'
  );
}

async function writeGraphData(
  outputDir: string,
  artifactSet: PublishArtifactSet
) {
  const outputPath = path.join(outputDir, GRAPH_DATA_PATH);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(artifactSet.graph, null, 2),
    'utf8'
  );
}

export async function writeStarlightSite(options: StarlightTargetOptions) {
  const includeProjectScaffold = options.includeProjectScaffold ?? true;
  const docsDir = path.join(options.outputDir, DOCS_DIR);
  const assetsDir = path.join(options.outputDir, ASSETS_DIR);
  const generatedDir = path.join(options.outputDir, GENERATED_DIR);

  if (includeProjectScaffold) {
    await writeTemplateFiles(options.outputDir);
  }

  await ensureCleanDir(docsDir);
  await ensureCleanDir(assetsDir);
  await ensureCleanDir(generatedDir);
  await writeDocs(options.outputDir, options.artifactSet);
  await copyAssets(options.outputDir, options.artifactSet);
  await writeGraphData(options.outputDir, options.artifactSet);
  await writeSiteConfig(
    options.outputDir,
    options.artifactSet,
    options.siteUrl
  );
  await writeRoutesManifest(options.outputDir, options.artifactSet);
}
