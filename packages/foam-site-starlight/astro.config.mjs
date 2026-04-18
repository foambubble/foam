import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Foam Site Spike',
      description: 'Static-site spike powered by Foam publishing output.',
    }),
  ],
});
