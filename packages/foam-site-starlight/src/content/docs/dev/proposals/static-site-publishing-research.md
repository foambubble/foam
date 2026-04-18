---
title: "Static Site Publishing Research"
description: "Published from /Users/riccardo/.codex/worktrees/a57a/foam/docs/dev/proposals/static-site-publishing-research.md"
---
# Static Site Publishing Research

Researched on April 17, 2026.

## Context

Foam already has a publishing story, but it is spread across older templates and partial proposals rather than a single modern architecture.

Relevant existing material in this repository:

- [Publishing pages](/user/publishing/publishing) says Foam should remain valid Markdown and be publishable by many tools, while leaving room for a more Foam-aware publishing path later.
- [Build vs Assemble](/dev/build-vs-assemble) argues for composing focused tools instead of locking Foam into a monolith.
- [Link reference definition improvements](/dev/proposals/link-reference-definition-improvements) already points toward a build-time publishing step that can rewrite links for different targets.
- [Materialized backlinks](/dev/proposals/materialized-backlinks) identifies backlinks as an important portability and publishing feature.
- [Roadmap](/dev/proposals/roadmap) already calls out improved static-site generation, search in published workspaces, graph in published workspaces, and publishing permissions.

That gives a fairly clear constraint set:

- Published output should preserve Foam semantics such as wikilinks, aliases, embeds, block anchors, backlinks, and queries where practical.
- The publishing path should stay optional. A Foam workspace should still be usable as normal Markdown without requiring a bespoke site generator.
- The implementation should fit a TypeScript-heavy codebase and reuse Foam's parsing and graph logic instead of reimplementing it in another stack.

## Evaluation Criteria

The tools were evaluated against these criteria:

- Quality of the generated site for documentation and knowledge-base content
- Ease of integrating Foam-specific behavior
- TypeScript support and extensibility
- Static output and deployment simplicity
- Suitability for a navigable knowledge base rather than only linear product docs

## What Obsidian Publish Gets Right

Obsidian Publish is the product benchmark, not the implementation benchmark.

Its public positioning emphasizes the reader experience for connected notes: hover previews, graph view, stacked navigation, backlinks, strong SEO, mobile support, and easy customization. Those are the right north-star features for Foam publishing even if Foam should not copy the hosted-product model.

Source:

- [Obsidian Publish](https://obsidian.md/publish)

## Option Review

## Astro

Astro is a strong foundation layer for Foam publishing.

Why it fits:

- It is modern, fast, and static-first.
- It has first-class TypeScript support.
- It supports Markdown and MDX directly.
- It has clear extension points through remark and rehype plugins.
- It has typed content collections that work well for structured frontmatter and derived metadata.

Most importantly, Astro is a good host for a Foam publishing adapter. It does not force Foam to adopt a new authoring model just to get a good site.

Sources:

- [Astro Markdown](https://docs.astro.build/en/guides/markdown-content/)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)

## Starlight

Starlight is the strongest out-of-the-box shell among the options reviewed.

Why it stands out:

- It produces polished documentation sites quickly.
- It includes site navigation, search, SEO, internationalization, readable typography, code highlighting, and dark mode out of the box.
- It supports Markdown, Markdoc, and MDX.
- It adds frontmatter validation with TypeScript type safety.
- It keeps access to the wider Astro ecosystem instead of boxing the project into a narrow template.

For Foam, this means the team can spend effort on Foam behavior instead of rebuilding the surrounding documentation-site basics.

Source:

- [Starlight](https://starlight.astro.build/)

## Markdoc

Markdoc is powerful, but it should not be the center of Foam's publishing architecture.

It is a good option for adding structured, component-rich authoring to specific parts of a site. However, using Markdoc as the canonical representation of Foam notes would move Foam away from portable Markdown and toward a richer custom syntax. That tradeoff does not look justified for the first version.

Markdoc is best treated as an optional layer for advanced authored pages, not as the base representation of the knowledge base itself.

Sources:

- [Markdoc](https://markdoc.dev/)
- [Astro Markdoc integration](https://docs.astro.build/en/guides/integrations-guide/markdoc/)

## Quartz

Quartz is the closest match to Foam's use case and should be treated as the main reference implementation.

Why it matters:

- It is explicitly oriented toward note graphs and digital gardens.
- It is configured in TypeScript.
- It exposes a plugin pipeline with transformers, filters, and emitters.
- It already supports popover previews, backlinks, graph view, explorer navigation, and full-text search.
- It includes an `ObsidianFlavoredMarkdown` plugin, which shows direct alignment with the knowledge-base space.

Quartz is compelling enough that it could be used for a fast proof of concept. The reason not to pick it as the primary foundation is not quality; it is control over architecture. Foam still needs a publishing layer for features like `foam-query`, publish permissions, and reuse of Foam core models. Once that layer exists, Astro and Starlight provide a cleaner long-term substrate for a broader website experience.

Sources:

- [Quartz Configuration](https://quartz.jzhao.xyz/configuration)
- [Quartz Explorer](https://quartz.jzhao.xyz/features/explorer)
- [Quartz Graph View](https://quartz.jzhao.xyz/features/graph-view)
- [Quartz Backlinks](https://quartz.jzhao.xyz/features/backlinks)
- [Quartz Popover Previews](https://quartz.jzhao.xyz/features/popover-previews)

## Docusaurus

Docusaurus is a capable modern documentation platform, but it does not look like the best fit for Foam's first publishing path.

It has strong support for search, versioning, internationalization, MDX, and theme customization. The issue is fit rather than capability: it is more naturally shaped for product documentation than for a wiki-like knowledge base with Foam-specific semantics.

It remains a viable option for projects that want a more React-centric docs platform, but it is not the best default recommendation for Foam.

Source:

- [Docusaurus Documentation](https://docusaurus.io/docs)

## Recommendation

The recommended direction is:

1. Use Astro as the web framework.
2. Use Starlight as the website shell.
3. Build a Foam-specific publishing layer in TypeScript.
4. Keep Markdoc optional.
5. Use Quartz as a reference point and comparison target, especially for graph, popover, backlinks, and navigation behavior.

This direction gives Foam a modern, polished static site without forcing Foam to become a site generator.

## Main Architectural Takeaway

The core design problem is not choosing a renderer. The core design problem is preserving Foam semantics on the web.

That implies a separation of concerns:

- Foam should own parsing, graph resolution, publish filtering, and content transformation.
- The site framework should own rendering, navigation chrome, styling, and deployment ergonomics.

That boundary is what the architecture note should lock down.
