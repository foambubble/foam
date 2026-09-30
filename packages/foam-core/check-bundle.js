#!/usr/bin/env node
//
// Portability gate, bundle half: bundles the built barrel for a browser
// platform and fails if anything in its module graph — including third-party
// dependencies — relies on a Node built-in.
//
// The type-check half (tsconfig.portability.json) only sees @foam/core's own
// sources, so a dependency that requires `util` or `path` passes it.
//
// Requires a prior `tsc -p tsconfig.json`: the entry point is the built
// output, which is what consumers bundle.
//
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');
const esbuild = require('esbuild');

const nodeBuiltins = new Set(builtinModules);

/** The manifest of the package that owns `file`. */
const owningPackage = file => {
  let dir = path.dirname(file);
  while (dir !== path.dirname(dir)) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      // Nested manifests without a name only mark a module format.
      if (pkg.name) {
        return pkg;
      }
    }
    dir = path.dirname(dir);
  }
  return {};
};

/**
 * Whether `pkg` accounts for an import of a built-in name outside Node: it
 * either depends on an npm package of that name, or switches the import off
 * (or remaps it) through its `browser` field.
 */
const handlesOutsideNode = (pkg, specifier, name) =>
  [pkg.dependencies, pkg.peerDependencies, pkg.optionalDependencies].some(
    deps => deps != null && name in deps
  ) ||
  (pkg.browser != null &&
    typeof pkg.browser === 'object' &&
    specifier in pkg.browser);

// Resolution alone is not a sufficient signal: several built-in names
// (`buffer`, `punycode`, `string_decoder`, ...) are also npm packages, and
// one that happens to be installed lets an undeclared import resolve.
const rejectNodeBuiltins = {
  name: 'reject-node-builtins',
  setup(build) {
    build.onResolve({ filter: /^[^.]/ }, args => {
      const specifier = args.path;
      const name = specifier.replace(/^node:/, '').split('/')[0];
      if (!specifier.startsWith('node:') && !nodeBuiltins.has(name)) {
        return undefined;
      }
      const pkg = owningPackage(args.importer);
      if (handlesOutsideNode(pkg, specifier, name)) {
        return undefined;
      }
      return {
        errors: [
          {
            text:
              `"${specifier}" is a Node built-in, and ${pkg.name} neither ` +
              `depends on an npm package of that name nor disables it in ` +
              `its "browser" field`,
          },
        ],
      };
    });
  },
};

esbuild
  .build({
    entryPoints: ['out/src/index.js'],
    bundle: true,
    platform: 'browser',
    write: false,
    logLevel: 'silent',
    plugins: [rejectNodeBuiltins],
  })
  .catch(error => {
    const messages = esbuild.formatMessagesSync(error.errors ?? [], {
      kind: 'error',
    });
    console.error(
      'The @foam/core barrel does not bundle for a non-Node runtime:\n'
    );
    console.error(messages.length > 0 ? messages.join('\n') : error);
    process.exit(1);
  });
