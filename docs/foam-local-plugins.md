# Foam Local Plugins

Foam can use workspace plugins to provide customization for users.

## Goal

Here are some of the things that we could enable with local plugins in Foam:
- extend the document syntax to support roam style attributes (e.g. `stage:: seedling`)
- automatically add tags to my notes based on the location in the repo (e.g. notes in `/areas/finance` will automatically get the `#finance` tag)
- add a new CLI command to support some internal use case or automate import/export
- extend the VSCode experience to support one's own workflow, e.g. weekly note, templates, extra panels, foam model derived TOC, ... all without having to write/deploy a VSCode extension

## Technical approach

When Foam is loaded it will:
- check `.foam/plugins` directory.
	- each directory in there is considered a plugin
	- the layout of each directory is
		- `index.js` contains the main info about the plugin, specifically it exports:
			- `name: string` the name of the plugin
			- `description?: string` the description of the plugin
			- `graphMiddleware?: Middleware` an object that can intercept calls to the Foam graph
			- `parser?: ParserPlugin` an object that interacts with the markdown parsing phase

Currently for simplicity we keep everything in one file. We might in the future split the plugin by domain (e.g. vscode, cli, core, ...)