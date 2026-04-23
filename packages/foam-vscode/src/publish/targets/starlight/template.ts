const DEFAULT_TITLE = 'Foam Site';
const DEFAULT_DESCRIPTION = 'Published from a Foam knowledge base.';
const GRAPH_COMPONENT_VERSION = '0.38.1';

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
          '@foam/graph': `^${GRAPH_COMPONENT_VERSION}`,
          '@astrojs/starlight': '^0.38.3',
          astro: '^6.1.7',
          lit: '^3.0.0',
        },
      },
      null,
      2
    ) + '\n',
  'astro.config.mjs': `import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const siteConfigUrl = new URL('./generated/site-config.json', import.meta.url);
const siteConfig = fs.existsSync(siteConfigUrl)
  ? JSON.parse(fs.readFileSync(siteConfigUrl, 'utf8'))
  : {};

function deSlugify(slug) {
  return slug.replace(/[-_]+/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
}

function buildSidebar(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !e.name.startsWith('_') && !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => {
      if (entry.isDirectory()) {
        const slug = prefix ? \`\${prefix}/\${entry.name}\` : entry.name;
        return {
          label: deSlugify(entry.name),
          items: buildSidebar(path.join(dir, entry.name), slug),
        };
      }
      const slug = (prefix ? \`\${prefix}/\` : '') + entry.name.replace(/\\.md$/, '');
      return { slug: slug === 'index' ? '' : slug };
    });
}

const docsDir = new URL('./src/content/docs', import.meta.url).pathname;
const sidebar = buildSidebar(docsDir);

export default defineConfig({
  site: siteConfig.siteUrl,
  integrations: [
    starlight({
      title: siteConfig.title ?? '${DEFAULT_TITLE}',
      description:
        siteConfig.description ??
        '${DEFAULT_DESCRIPTION}',
      sidebar,
      components: {
        Footer: './src/components/FoamFooter.astro',
        PageSidebar: './src/components/FoamPageSidebar.astro',
      },
      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
`,
  'src/components/FoamPageSidebar.astro': `---
import MobileTableOfContents from 'virtual:starlight/components/MobileTableOfContents';
import TableOfContents from 'virtual:starlight/components/TableOfContents';
import siteConfig from '../../generated/site-config.json';

const { toc } = Astro.locals.starlightRoute;

function normalizeBasePath(value) {
  const trimmed = String(value ?? '/')
    .replace(/\\/+$/g, '')
    .replace(/^\\/+$/g, '')
    .trim();
  return trimmed.length > 0 ? '/' + trimmed.replace(/^\\/+/, '') : '';
}

function stripBasePath(pathname, basePath) {
  if (!basePath) {
    return pathname;
  }

  if (pathname === basePath) {
    return '/';
  }

  if (pathname.startsWith(basePath + '/')) {
    return pathname.slice(basePath.length) || '/';
  }

  return pathname;
}

function normalizeRoute(value, basePath = '') {
  const pathname = String(value ?? '').split(/[?#]/, 1)[0] || '/';
  const withoutBase = stripBasePath(pathname, basePath);

  if (withoutBase === '/') {
    return '/';
  }

  return withoutBase.replace(/\\/+$/, '') || '/';
}

const currentRoute = normalizeRoute(
  Astro.url.pathname,
  normalizeBasePath(import.meta.env.BASE_URL)
);
const selectedRoute =
  currentRoute === '/' && siteConfig.homepageRoute
    ? siteConfig.homepageRoute
    : currentRoute;
---

<>
  {toc && (
    <div class="lg:sl-hidden">
      <MobileTableOfContents />
    </div>
  )}

  <div class="right-sidebar-panel sl-hidden lg:sl-block">
    <div class="sl-container">
      <foam-graph
        class="foam-sidebar-graph"
        data-current-route={selectedRoute}
      ></foam-graph>

      {toc && <TableOfContents />}
    </div>
  </div>
</>

<script>
  import '@foam/graph';

  const normalizeBasePath = value => {
    const trimmed = String(value ?? '/')
      .replace(/\\/+$/g, '')
      .replace(/^\\/+$/g, '')
      .trim();
    return trimmed.length > 0 ? '/' + trimmed.replace(/^\\/+/, '') : '';
  };

  const stripBasePath = (pathname, basePath) => {
    if (!basePath) {
      return pathname;
    }

    if (pathname === basePath) {
      return '/';
    }

    if (pathname.startsWith(basePath + '/')) {
      return pathname.slice(basePath.length) || '/';
    }

    return pathname;
  };

  const normalizeRoute = (value, basePath = '') => {
    const pathname = String(value ?? '').split(/[?#]/, 1)[0] || '/';
    const withoutBase = stripBasePath(pathname, basePath);

    if (withoutBase === '/') {
      return '/';
    }

    return withoutBase.replace(/\\/+$/, '') || '/';
  };

  const joinBasePath = (basePath, route) => (basePath ? basePath + route : route);
  const readCssVar = name =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const siteBasePath = normalizeBasePath(import.meta.env.BASE_URL);
  const graphDataUrl = new URL(
    joinBasePath(siteBasePath, '/foam-graph.json'),
    window.location.origin
  ).toString();

  const buildGraphStyle = () => ({
    colorMode: 'none',
    showNodesOfType: {
      note: true,
      tag: false,
      placeholder: false,
      image: false,
      attachment: false,
    },
    style: {
      background: readCssVar('--sl-color-bg-nav') || '#111827',
      fontFamily: 'inherit',
      fontSize: 8,
      lineColor: readCssVar('--sl-color-hairline-light') || '#334155',
      highlightedForeground:
        readCssVar('--sl-color-text-accent') || '#38bdf8',
      node: {
        note:
          readCssVar('--sl-color-text') ||
          readCssVar('--sl-color-white') ||
          '#e5e7eb',
        placeholder: readCssVar('--sl-color-text-secondary') || '#64748b',
        tag:
          readCssVar('--sl-color-text-accent') ||
          readCssVar('--sl-color-accent-high') ||
          '#38bdf8',
      },
    },
  });

  const attachControlPanelHider = graph => {
    const hide = () => {
      graph.showControls = false;
      const controlPanel = graph.shadowRoot?.querySelector('foam-control-panel');
      if (controlPanel instanceof HTMLElement) {
        controlPanel.style.display = 'none';
      }
    };

    hide();
    requestAnimationFrame(hide);
    window.setTimeout(hide, 0);

    if (graph.shadowRoot && graph.dataset.foamGraphObserverAttached !== 'true') {
      const observer = new MutationObserver(hide);
      observer.observe(graph.shadowRoot, { childList: true, subtree: true });
      graph.dataset.foamGraphObserverAttached = 'true';
    }
  };

  const toSiteUrl = route =>
    new URL(
      joinBasePath(siteBasePath, normalizeRoute(route)),
      window.location.origin
    ).toString();

  const graphDataPromise = fetch(graphDataUrl).then(async response => {
    if (!response.ok) {
      throw new Error('Failed to load published graph data.');
    }

    return response.json();
  });

  const initGraph = async graph => {
    try {
      attachControlPanelHider(graph);

      graph.graphData = await graphDataPromise;
      graph.graphStyle = buildGraphStyle();
      graph.selection = {
        ...graph.selection,
        enableRefocus: false,
        enableZoom: false,
      };
      attachControlPanelHider(graph);

      const currentRoute = normalizeRoute(
        graph.dataset.currentRoute || window.location.pathname,
        siteBasePath
      );

      requestAnimationFrame(() => {
        if (typeof graph.selectNote === 'function') {
          graph.selectNote(currentRoute);
        }
      });

      const themeObserver = new MutationObserver(() => {
        graph.graphStyle = buildGraphStyle();
        attachControlPanelHider(graph);
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      });

      graph.addEventListener('node-click', event => {
        const targetRoute = normalizeRoute(event.detail);
        if (targetRoute === currentRoute) {
          return;
        }

        window.location.assign(toSiteUrl(targetRoute));
      });
    } catch (error) {
      graph.hidden = true;
      console.error('Failed to initialize the Foam graph sidebar.', error);
    }
  };

  document
    .querySelectorAll('.foam-sidebar-graph')
    .forEach(graph => void initGraph(graph));
</script>

<style>
  .right-sidebar-panel {
    padding: 1rem var(--sl-sidebar-pad-x);
  }

  .sl-container {
    width: calc(var(--sl-sidebar-width) - 2 * var(--sl-sidebar-pad-x));
  }

  .foam-sidebar-graph {
    border: 1px solid var(--sl-color-hairline-light);
    border-radius: 0.75rem;
    display: block;
    height: clamp(12rem, 28vh, 14rem);
    margin-bottom: 1rem;
    overflow: hidden;
    width: 100%;
  }

  @media (min-width: 72rem) {
    .sl-container {
      max-width: calc(
        (
          (
              100vw - var(--sl-sidebar-width) - 2 * var(--sl-content-pad-x) - 2 *
                var(--sl-sidebar-pad-x)
            ) * 0.25
        )
      );
    }
  }
</style>
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
