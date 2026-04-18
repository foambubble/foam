import fs from 'node:fs/promises';
import path from 'node:path';

import { URI } from '../../foam-vscode/src/core/model/uri.ts';
import { FoamWorkspace } from '../../foam-vscode/src/core/model/workspace.ts';
import {
  MarkdownResourceProvider,
} from '../../foam-vscode/src/core/services/markdown-provider.ts';
import {
  createMarkdownParser,
} from '../../foam-vscode/src/core/services/markdown-parser.ts';
import { buildSite } from '../../foam-vscode/src/publish/index.ts';

const SOURCE_ROOT = path.resolve(__dirname, '../../../docs');
const SOURCE_ASSETS_DIR = path.join(SOURCE_ROOT, 'assets');
const OUTPUT_DOCS_DIR = path.resolve(__dirname, '../src/content/docs');
const OUTPUT_PUBLIC_DIR = path.resolve(__dirname, '../public');
const OUTPUT_ASSETS_DIR = path.join(OUTPUT_PUBLIC_DIR, 'assets');
const OUTPUT_GENERATED_DIR = path.resolve(__dirname, '../generated');

class FsDataStore {
  constructor(private readonly baseDir: string) {}

  async list() {
    const files: string[] = [];
    await collectFiles(this.baseDir, files);
    return files.map(file => URI.file(file));
  }

  async read(uri: URI) {
    try {
      return await fs.readFile(uri.toFsPath(), 'utf8');
    } catch {
      return null;
    }
  }
}

async function collectFiles(dir: string, files: string[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
      continue;
    }

    files.push(fullPath);
  }
}

async function ensureCleanDir(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

function routeToDocPath(route: string) {
  if (route === '/') {
    return 'index.md';
  }

  return `${route.replace(/^\/+/, '')}.md`;
}

function escapeFrontmatter(value: string) {
  return value.replace(/"/g, '\\"');
}

function renderFrontmatter(note: {
  title: string;
  description?: string;
  sourceUri: URI;
}) {
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

function isFrameworkHandledRoute(route: string) {
  return route === '/404';
}

function renderBacklinks(
  backlinks: Array<{ route: string; title: string }> | undefined
) {
  if (!backlinks || backlinks.length === 0) {
    return '';
  }

  const items = backlinks
    .map(link => `- [${link.title}](${link.route})`)
    .join('\n');
  return `\n\n## Backlinks\n\n${items}\n`;
}

function rewriteStaticAssetPaths(markdown: string) {
  return markdown
    .replace(/\]\(((?:\.\.\/)*assets\/[^)]+)\)/g, (_match, assetPath) => {
      return `](/${String(assetPath).replace(/^(?:\.\.\/)+/, '')})`;
    })
    .replace(/(src|href)="((?:\.\.\/)*assets\/)/g, (_match, attr, assetPath) => {
      return `${attr}="/${String(assetPath).replace(/^(?:\.\.\/)+/, '')}`;
    });
}

async function writeDocs(
  artifactSet: Awaited<ReturnType<typeof buildSite>>
) {
  for (const note of artifactSet.notes) {
    if (isFrameworkHandledRoute(note.route)) {
      continue;
    }

    if (artifactSet.site.homepageRoute && artifactSet.site.homepageRoute !== '/' && note.route === '/') {
      continue;
    }

    const relativePath = routeToDocPath(note.route);
    const outputPath = path.join(OUTPUT_DOCS_DIR, relativePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await fs.writeFile(
      outputPath,
      `${renderFrontmatter(note)}${rewriteStaticAssetPaths(note.markdown)}${renderBacklinks(
        note.backlinks
      )}`,
      'utf8'
    );
  }

  if (artifactSet.site.homepageRoute && artifactSet.site.homepageRoute !== '/') {
    const homepageNote = artifactSet.notes.find(
      note => note.route === artifactSet.site.homepageRoute
    );

    if (homepageNote) {
      const outputPath = path.join(OUTPUT_DOCS_DIR, 'index.md');
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(
        outputPath,
        `${renderFrontmatter(homepageNote)}${rewriteStaticAssetPaths(
          homepageNote.markdown
        )}${renderBacklinks(homepageNote.backlinks)}`,
        'utf8'
      );
    }
  }
}

async function copyAssets(
  artifactSet: Awaited<ReturnType<typeof buildSite>>
) {
  for (const asset of artifactSet.assets) {
    const relativeOutput = asset.outputPath.replace(/^assets\//, '');
    const outputPath = path.join(OUTPUT_ASSETS_DIR, relativeOutput);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(asset.sourceUri.toFsPath(), outputPath);
  }
}

async function copyDirectory(sourceDir: string, targetDir: string) {
  try {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        await copyDirectory(sourcePath, targetPath);
      } else {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

async function writeSiteConfig(
  artifactSet: Awaited<ReturnType<typeof buildSite>>
) {
  const outputPath = path.join(OUTPUT_GENERATED_DIR, 'site-config.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        title: artifactSet.site.title,
        description: artifactSet.site.description,
        homepageRoute: artifactSet.site.homepageRoute,
      },
      null,
      2
    ),
    'utf8'
  );
}

async function main() {
  const rootUri = URI.file(SOURCE_ROOT);
  const dataStore = new FsDataStore(SOURCE_ROOT);
  const parser = createMarkdownParser();
  const provider = new MarkdownResourceProvider(dataStore, parser, ['.md']);
  const workspace = await FoamWorkspace.fromProviders(
    [rootUri],
    [provider],
    dataStore
  );

  const artifactSet = await buildSite({
    workspace,
    include: resource => resource.properties.publish !== false,
    site: {
      title: 'Foam Site Spike',
      description: 'Static-site spike powered by Foam publishing output.',
      homepage: note => note.uri.path.endsWith('/index.md'),
    },
  });

  await ensureCleanDir(OUTPUT_DOCS_DIR);
  await ensureCleanDir(OUTPUT_ASSETS_DIR);
  await writeDocs(artifactSet);
  await copyAssets(artifactSet);
  await copyDirectory(SOURCE_ASSETS_DIR, OUTPUT_ASSETS_DIR);
  await writeSiteConfig(artifactSet);

  const manifestPath = path.join(OUTPUT_PUBLIC_DIR, 'publish-routes.json');
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(
    manifestPath,
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

  process.stdout.write(
    `Generated ${artifactSet.notes.length} notes and ${artifactSet.assets.length} assets from ${SOURCE_ROOT}\n`
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
