import {
  window,
  commands,
  ExtensionContext,
  workspace,
  Uri,
  SnippetString,
  Location,
  Position
} from "vscode";
import * as fs from "fs";
import * as path from "path";
import { FoamFeature } from "../types";
import GithubSlugger from "github-slugger";
import { TextEncoder } from "util";
import { focusNote } from "../utils";

async function getTemplates(): Promise<string[]> {
  const templates = await workspace.findFiles(".foam/templates/**.md");
  // parse title, not whole file!
  return templates.map(template => path.basename(template.fsPath));
}

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand(
        "foam-vscode.create-note-from-template",
        async (context: ExtensionContext) => {
          const templates = await getTemplates();
          const activeFile = window.activeTextEditor?.document?.fileName;
          const currentDir =
            activeFile !== undefined
              ? path.dirname(activeFile)
              : workspace.workspaceFolders[0].uri.fsPath;
          const selectedTemplate = await window.showQuickPick(templates);
          const folder = await window.showInputBox({
            prompt: `Where should the template be created?`,
            value: currentDir
          });
          const title = await window.showInputBox({
            prompt: `Enter the Title Case name for the new note`,
            value: ``,
            validateInput: value =>
              value.length ? undefined : "Please enter a value!"
          });
          const targetFile = path.join(
            folder,
            `${new GithubSlugger().slug(title)}.md`
          );

          const templateText = await workspace.fs.readFile(
            Uri.file(
              `${workspace.workspaceFolders[0].uri.fsPath}/.foam/templates/${selectedTemplate}`
            )
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
