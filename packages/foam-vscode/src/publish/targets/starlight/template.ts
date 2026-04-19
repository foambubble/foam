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
      components: {
        Footer: './src/components/FoamFooter.astro',
      },
    }),
  ],
});
`,
  'src/components/FoamFooter.astro': `---
import type { Props } from '@astrojs/starlight/props';
import Default from '@astrojs/starlight/components/Footer.astro';

const props = Astro.props as Props;
---

<Default {...props} />

<div class="foam-powered-by">
  Powered by <a href="https://foamnotes.com">Foam</a>
</div>

<style>
  .foam-powered-by {
    border-top: 1px solid var(--sl-color-hairline-light);
    color: var(--sl-color-text-secondary);
    font-size: var(--sl-text-xs);
    margin-top: 1.5rem;
    padding-top: 1rem;
    text-align: center;
  }

  .foam-powered-by a {
    color: inherit;
    font-weight: 600;
    text-decoration: none;
  }

  .foam-powered-by a:hover {
    text-decoration: underline;
  }
</style>
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
