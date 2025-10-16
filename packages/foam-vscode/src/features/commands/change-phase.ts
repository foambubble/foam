import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { URI } from '../../core/model/uri';
import { CommandDescriptor } from '../../utils/commands';
import { FoamWorkspace } from '../../core/model/workspace/foamWorkspace';
import { isNone } from '../../core/utils';
import { TrainNote, TrainNoteStepper } from '../../core/model/train-note';
import { WriteObserver } from '../../core/utils/observer';
import { TrainNoteWriter } from '../../core/services/Writer/train-note-writer';
import { FrontmatterWriter } from '../../services/frontmatter-writer';

export default async function activate(
  context: vscode.ExtensionContext,
  foamPromise: Promise<Foam>
) {
  const foam = await foamPromise;
  context.subscriptions.push(
    vscode.commands.registerCommand(RAISE_COMMAND.command, args =>
      raisePhase(foam.workspace, args)
    )
  );
}

export interface RaisePhaseArgs {
  /**
   * The URI of the TrainNote to Raise
   * If present the active Document is ignored
   */
  uri?: URI | string | vscode.Uri;
}

export const RAISE_COMMAND = {
  command: 'foam-vscode.raise-phase',
  title: 'Foam: Raise Phase',

  forURI: (uri: URI): CommandDescriptor<RaisePhaseArgs> => {
    return {
      name: RAISE_COMMAND.command,
      params: {
        uri: uri,
      },
    };
  },
};

async function raisePhase(workspace: FoamWorkspace, args: RaisePhaseArgs) {
  args = args ?? {};

  const path = getPath(args);

  const result = canIncrease(path, workspace);
  if (isNone(result.value)) {
    vscode.window.showInformationMessage(result.msg);
    return;
  }

  increase(result.value);
}

function canIncrease(path, workspace: FoamWorkspace) {
  const result = workspace.trainNoteWorkspace.find(path);
  if (result instanceof TrainNote) {
    return { value: result, msg: '' };
  }

  return { msg: 'Could not find Trainnote. Are you sure you selected one?' };
}

function increase(trainNote: TrainNote) {
  const stepper = new TrainNoteStepper(
    new WriteObserver(new TrainNoteWriter(new FrontmatterWriter()))
  );
  stepper.increase(trainNote);
}

function getPath(args: RaisePhaseArgs) {
  const activeDocument = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      return editor.document.uri.fsPath;
    }
  };

  if (isNone(args.uri)) {
    return activeDocument();
  }
  return args.uri;
}
