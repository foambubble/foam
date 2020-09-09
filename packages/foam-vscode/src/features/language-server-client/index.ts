import * as path from "path";
import { workspace, ExtensionContext } from "vscode";
import { FoamFeature } from "../../types";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from "vscode-languageclient";

let client: LanguageClient;

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    // @TODO figure out path for production deploys
    let serverModule = context.asAbsolutePath(
      path.join("..", "foam-language-server", "dist", "index.js")
    );

    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions: ServerOptions = {
      run: { module: serverModule, transport: TransportKind.ipc },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: debugOptions
      }
    };

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
      // Register the server for plain markdown documents
      documentSelector: [
        { scheme: "file", language: "markdown" },
        { scheme: "file", language: "mdx" }
      ],
      synchronize: {
        fileEvents: workspace.createFileSystemWatcher(
          "**/.vscode/settings.json"
        )
      }
    };

    // Create the language client and start the client.
    client = new LanguageClient(
      "foam-language-server",
      "Foam Language Server",
      serverOptions,
      clientOptions
    );

    console.log(
      "Starting foam-language-server with options\n",
      JSON.stringify(serverOptions, null, 2)
    );

    // Start the client. This will also launch the server
    client.start();
  },
  deactivate() {
    if (client) {
      console.log("Stopping foam-language-server");
      return client.stop();
    }
  }
};

export default feature;
