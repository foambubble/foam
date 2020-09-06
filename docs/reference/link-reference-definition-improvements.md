# Link Reference Definition Improvements

## Current Problems

### File-by-file Insertion

For the time being, if you want to get [[wiki-links]] into all files within the workspace, you'll need to generate the link reference definitions yourself file-by-file (with the assistance of Foam).

### Wikilinks don't work on GitHub

> **TL;DR;** [workaround](#workaround) in the end of the chapter.

If you click any of the wiki-links on GitHub web UI (such as the `README.md` of a project), you'll notice that the links break with a 404 error.

At the time of writing (June 28 2020) this is a known, but unsolved error. To understand why this is the case, we need to understand what we are trading off.

So, why don't they work on GitHub?

The three components of [[link-reference-definitions]] are link label, link destination and Link Title.

The issue is the middle **link destination** component. It's configured to point to the file name **without file extension**, i.e. "file-name" instead of "file-name.md". This is to make the GitHub Pages rendering work, because if we generated the links to `file-name.md`, the links would point to the raw markdown files instead of their generated HTML versions.

| Environment      | `file-name` | `file-name.md` |
| ---------------- | ----------- | -------------- |
| **VS Code**      | Works       | Works          |
| **GitHub pages** | Works       | Breaks         |
| **GitHub UI**    | Breaks      | Works          |

So as you can see, we've prioritised GitHub Pages over GitHub Web UI for the time being.

Ideally, we'd like a solution that works with both, but it's not defined yet (see [[link-reference-definitions]] for more details)

#### Workaround

For the time being, you can use relative `[markdown links](markdown-link.md)` syntax.

**Pros:**

- This will work on all platforms.

**Cons:**

- It will break the Markdown Notes [[backlinking]] support
- Less convenient to write

### Finding certain words clutter the VS Code search results

Since link reference definitions have `[//begin]` and `[//end]` guards with explanatory text that use certain words, these words (like "generate") appear in VS Code search results if you happen to search matching strings from the workspace.

## Improvement Proposal

Problem space in essence:

- During edit-time (when modifying the markdown files in an editor)
  - link reference definitions are needed if user uses editor extensions that don't understand wikilinks
  - link reference definitions may be annoying since they 
    - add content to files that the user hasn't typed in by themselves
    - get out of date if user uses a tool that doesn't autogenerate them
    - may clutter the search results
- During build-time (when converting markdown to html for publishing purposes)
  - link reference definitions are needed, if the files are published via such tools (or to such platforms) that don't understand wikilinks
  - link reference definitions might have to be in different formats depending on the publish target (e.g. Github pages vs Github UI)

The potential solution:

- For edit-time
  - Make edit-time link reference definition generation optional via user settings. They should be on by default, and generating valid markdown links with a relative path to a `.md` file.
  - Make format of the link reference definition configurable (whether to include '.md' or not)
  - Out of recommended extensions, currently only "markdown links" doesn't support them (?). However even its [code](https://github.com/tchayen/markdown-links/blob/master/src/parsing.ts#L25) seems to include wikilink parser, so it might just be a bug?
- For build-time
  - To satisfy mutually incompatible constraints between GitHub UI, VSCode UI, and GitHub Pages, we should add a pre-processing/build step for pushing to GitHub Pages. 
    - This would be a GitHub action (or a local script, ran via foam-cli) that outputs publish-friendly markdown format for static site generators and other publishing tools
    - This build step should be pluggable, so that other transformations could be ran during it
  - Have publish targets defined in settings, that support both turning the link reference definitions on/off and defining their format (.md or not). Example draft (including also edit-time aspect):
    ```typescript
    // settings json
    // see enumerations below for explanations on values
    {
      "foam": {
        "publish": [
          {
            "name": "Gitlab Mirror",     // name of the publish target
            "linkTranspilation": "Off",
            "linkReferenceDefinitions": "withExtensions"
          },
          {
            "name": "GitHub Pages",
            "linkTranspilation": "Off",
            "linkReferenceDefinitions": "withoutExtensions"
          },
          {
            "name": "Blog",
            "linkTranspilation": "Off",
            "linkReferenceDefinitions": "Off"
          },
          {
            "name": "My Amazing PDF book",
            "linkTranspilation": "WikiLinksToMarkdown"
          }
        ],
        "edit": {
          "linkReferenceDefinitions": "Off"
        }
      }
    }

    // Defines if and how links in markdown files are somehow converted (in-place) during build time
    // Note that this enumeration is not valid edit-time, since we (probably) don't want to change text like this while user is editing it
    enum LinkTranspilation {
      Off,                   // links are not transpiled
      WikiLinksToMarkdown,   // links using wiki-format [[link]] are converted to normal md links: [link](./some/file.md)
                             // if this is set, not link reference definitions are generated (not needed)
    }
    
    // Defines if and how link reference definition section is generated
    enum LinkReferenceDefinitions {
      Off,               // link reference definitions are not generated
      WithExtensions,    // link reference definitions contain .md (or similar) file extensions
      WithoutExtensions  // link reference definitions do not contain file extenions
    }

    ```
  - With Foam repo, just use edit-time link reference definitions with '.md' extension - this makes the links work in the Github UI
  - Have publish target defined for Github pages, that doesn't use '.md' extension, but still has the link reference definitions. Generate the output into gh-pages branch (or separate repo) with automation.
    - This naturally requires first removing the existing link reference definitions during the build
- Other
  - To clean up the search results, remove link reference definition section guards (assuming that these are not defined by the markdown spec). Use unifiedjs parse trees to identify if there's missing (or surplus) definitions (check if they are identified properly by the library), and just add the needed definitions to the bottom of the file (without guards) AND remove them if they are not needed (anywhere from the file).

Note that the proposal above supports both (build-time) inline transpilation of wikilinks as well as creation reference definitions. Depending on the direction of Foam, also only one of them could be selected. In that case the other could be implemented at later point of time.

UI-wise, the publish targets could be picked in some similar fashion as the run/debug targets in vscode by implementing a separate panel, or maybe through command execution (CTRL+SHIFT+P) - not yet defined at this point.

## Links

- [tracking issue on GitHub](https://github.com/foambubble/foam/issues/16)

[//begin]: # "Autogenerated link references for markdown compatibility"
[wiki-links]: wiki-links "Wiki Links"
[link-reference-definitions]: link-reference-definitions "Link Reference Definitions"
[backlinking]: backlinking "Backlinking"
[//end]: # "Autogenerated link references"
