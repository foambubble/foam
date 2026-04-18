import fs from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const siteConfigUrl = new URL('./generated/site-config.json', import.meta.url);
const siteConfig = fs.existsSync(siteConfigUrl)
  ? JSON.parse(fs.readFileSync(siteConfigUrl, 'utf8'))
  : {};

export default defineConfig({
  integrations: [
    starlight({
      title: siteConfig.title ?? 'Foam Site Spike',
      description:
        siteConfig.description ??
        'Static-site spike powered by Foam publishing output.',
    }),
  ],
});
