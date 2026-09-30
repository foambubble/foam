#!/usr/bin/env node
//
// Portability gate, bundle half: bundles the built barrel for a browser
// platform and fails if anything in its module graph — including third-party
// dependencies — imports a Node built-in.
//
// The type-check half (tsconfig.portability.json) only sees @foam/core's own
// sources, so a dependency that requires `util` or `path` passes it.
//
// Requires a prior `tsc -p tsconfig.json`: the entry point is the built
// output, which is what consumers bundle.
//
const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['out/src/index.js'],
    bundle: true,
    platform: 'browser',
    write: false,
    logLevel: 'silent',
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
