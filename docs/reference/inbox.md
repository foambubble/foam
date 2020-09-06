# Inbox

Uncategorised thoughts, to be added

- Release notes
- Markdown Preview
  - It's possible to customise the markdown preview styling. **Maybe make it use local foam workspace styles for live preview of the site??**
    - See: https://marketplace.visualstudio.com/items?itemName=bierner.markdown-preview-github-styles
- Use VS Code [CodeTour](https://marketplace.visualstudio.com/items?itemName=vsls-contrib.codetour) for onboarding
- Investigate other similar extensions:
  - [Unotes](https://marketplace.visualstudio.com/items?itemName=ryanmcalister.Unotes)
  - [vscode-memo](https://github.com/svsool/vscode-memo)
  - [gistpad wiki](https://github.com/jevakallio/gistpad/tree/master/src/repos/wiki)
- Open in Foam
  - When you want to open a Foam published website in your own VS Code, we could have a "Open in Foam" link that opens the link in VS Code via a url binding (if possible), downloads the github repo locally, and opens it as a Foam workspace.
  - Every Foam could have a different theme even in the editor, so you'll see it like they see it
    - UI and layout design of your workspace can become a thing
- Developer documentation
  - GistPad has a good vs code contrib primer: https://github.com/jevakallio/gistpad/blob/master/CONTRIBUTING.md  
- VS Code Notebooks API
  - https://code.visualstudio.com/api/extension-guides/notebook
- Snippets in template
- Foam as a (VS Code) language
  - Syntax highlighting
  - Snippets
- Future architecture
  - Could we do publish-related settings as a pre-push git hook, e.g. generating footnote labels
  - Running them on Github Actions to edit stuff as it comes in
    - Ideally, we shouldn't have to touch files, should be just markdown
- Looking at the errors/warnings/output panes makes me think, what kind of automated quality tools could we write.
  - Deduplication, finding similarities...
  - Thought Debugger?
  - Knowledge Debugger?
  - Janitor? Gardener?
  - Foam Compiler?
- Should support Netlify deploys out of the box
- Foam should tick at the same frequency as your brain, and the Foam graph you build should match the mental model you have in your head, making navigation effortless.
  - Maps have persistent topologies. As the graph grows, you should be able to visualise where an idea belongs. Maybe a literal map? And island? A DeckGL visualisation?
- Write about the history and process of Foam
  - In ways, Wallet was the first iteration of Foam-like environment
- Should we support directories?
  - Some tools might get more complicated to build
  - The pressure to categorize and create hierachies can become distracting
  - Is there value in folderizing?
  - Use case: Writing docs in a codebase

Testing: This file is served from the /docs directory.


