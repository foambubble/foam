const DEFAULT_TITLE = 'Foam Site';
const DEFAULT_DESCRIPTION = 'Published from a Foam knowledge base.';

export const STARLIGHT_TEMPLATE_FILES = {
  '.gitignore': ['node_modules/', 'dist/', '.astro/'].join('\n') + '\n',
  'package.json': JSON.stringify(
    {
      name: 'foam-published-site',
      version: '0.0.0',
      private: true,
      scripts: {
        dev: 'astro dev',
        build: 'astro build',
        preview: 'astro preview',
      },
      dependencies: {
        '@astrojs/starlight': '^0.38.3',
        astro: '^6.1.7',
      },
    },
    null,
    2
  ) + '\n',
  'astro.config.mjs': `import fs from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const siteConfigUrl = new URL('./generated/site-config.json', import.meta.url);
const siteConfig = fs.existsSync(siteConfigUrl)
  ? JSON.parse(fs.readFileSync(siteConfigUrl, 'utf8'))
  : {};

export default defineConfig({
  site: siteConfig.siteUrl,
  integrations: [
    starlight({
      title: siteConfig.title ?? '${DEFAULT_TITLE}',
      description:
        siteConfig.description ??
        '${DEFAULT_DESCRIPTION}',
    }),
  ],
});
`,
  'src/content.config.ts': `import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
  }),
};
`,
  'tsconfig.json': JSON.stringify(
    {
      extends: 'astro/tsconfigs/strict',
    },
    null,
    2
  ) + '\n',
} as const;

