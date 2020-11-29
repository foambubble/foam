import {
  window,
  commands,
  ExtensionContext,
  workspace,
  Uri,
  SnippetString
} from "vscode";
import * as path from "path";
import { FoamFeature } from "../types";
import { TextEncoder } from "util";
import { focusNote } from "../utils";

const templatesDir = `${workspace.workspaceFolders[0].uri.path}/.foam/templates`;

async function getTemplates(): Promise<string[]> {
  const templates = await workspace.findFiles(".foam/templates/**.md");
  // parse title, not whole file!
  return templates.map(template => path.basename(template.path));
}

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        "foam-vscode.create-note-from-template",
        async () => {
          const templates = await getTemplates();
          const activeFile = window.activeTextEditor?.document?.fileName;
          const currentDir =
            activeFile !== undefined
              ? path.dirname(activeFile)
              : workspace.workspaceFolders[0].uri.path;
          const selectedTemplate = await window.showQuickPick(templates);
          const folder = await window.showInputBox({
            prompt: `Where should the template be created?`,
            value: currentDir
          });

          let filename = await window.showInputBox({
            prompt: `Enter the filename for the new note`,
            value: ``,
            validateInput: value =>
              value.length ? undefined : "Please enter a value!"
          });
          filename = path.extname(filename).length
            ? filename
            : `${filename}.md`;
          const targetFile = path.join(folder, filename);

          const templateText = await workspace.fs.readFile(
            Uri.file(`${templatesDir}/${selectedTemplate}`)
          );
          const snippet = new SnippetString(templateText.toString());
          await workspace.fs.writeFile(
            Uri.file(targetFile),
            new TextEncoder().encode("")
          );
          await focusNote(targetFile, true);
          await window.activeTextEditor.insertSnippet(snippet);
        }
      )
    );
  }
};

export default feature;
