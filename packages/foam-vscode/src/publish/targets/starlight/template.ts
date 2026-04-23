const DEFAULT_TITLE = 'Foam Site';
const DEFAULT_DESCRIPTION = 'Published from a Foam knowledge base.';

export const STARLIGHT_TEMPLATE_FILES = {
  '.gitignore': ['node_modules/', 'dist/', '.astro/'].join('\n') + '\n',
  'package.json':
    JSON.stringify(
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
      customCss: ['./src/styles/custom.css'],
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
  Published with <a href="https://foamnotes.com">Foam</a>
</div>

<style>
  .foam-powered-by {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    background: var(--sl-color-bg-nav);
    border: 1px solid var(--sl-color-hairline-light);
    border-radius: 999px;
    color: var(--sl-color-text-secondary);
    font-size: var(--sl-text-xs);
    opacity: 0.85;
    padding: 0.25rem 0.75rem;
    z-index: 100;
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
  'src/styles/custom.css': `
.backlinks {
  border-top: 1px solid var(--sl-color-hairline-light);
  margin-top: 2rem;
  padding-top: 1rem;
}

.backlinks-label {
  color: var(--sl-color-white);
  font-size: var(--sl-text-sm);
  font-weight: 600;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
}

.backlinks a {
  display: block;
  font-size: var(--sl-text-sm);
}
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
  'tsconfig.json':
    JSON.stringify(
      {
        extends: 'astro/tsconfigs/strict',
      },
      null,
      2
    ) + '\n',
} as const;
