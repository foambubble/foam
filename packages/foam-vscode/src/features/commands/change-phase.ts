import * as vscode from 'vscode';
import { Foam } from '../../core/model/foam';
import { URI } from '../../core/model/uri';
import { CommandDescriptor } from '../../utils/commands';
import { FoamWorkspace } from '../../core/model/workspace/foamWorkspace';
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
      changePhase(canChange, increase, {
        workspace: foam.workspace,
        uri: args,
      })
    ),
    vscode.commands.registerCommand(RETRY_COMMAND.command, args => {
      changePhase(canChange, decrease, {
        workspace: foam.workspace,
        uri: args,
      });
    })
  );
}

export interface ChangePhaseArgs {
  /**
   * The URI of the TrainNote to Raise
   * If present the active Document is ignored
   */
  uri?: URI | string;
  workspace: FoamWorkspace;
}

export const RAISE_COMMAND = {
  command: 'foam-vscode.raise-phase',
  title: 'Foam: Raise Phase',

  forURI: (
    uri: URI,
    workspace: FoamWorkspace
  ): CommandDescriptor<ChangePhaseArgs> => {
    return {
      name: RAISE_COMMAND.command,
      params: {
        uri: uri,
        workspace: workspace,
      },
    };
  },
};

export const RETRY_COMMAND = {
  command: 'foam-vscode.retry-phase',
  title: 'Foam: Retry Phase',

  forURI: (
    uri: URI,
    workspace: FoamWorkspace
  ): CommandDescriptor<ChangePhaseArgs> => {
    return {
      name: RETRY_COMMAND.command,
      params: {
        uri: uri,
        workspace: workspace,
      },
    };
  },
};

function changePhase(
  canExecute: (args: ChangePhaseArgs) => { value?: TrainNote; msg: string },
  execute: (trainNote: TrainNote) => void,
  args: ChangePhaseArgs
) {
  SetPath(args);

  const result = canExecute(args);
  if (!result.value) {
    vscode.window.showInformationMessage(result.msg);
    return;
  }
  execute(result.value);
}

function canChange(args: ChangePhaseArgs) {
  const result = args.workspace.trainNoteWorkspace.find(args.uri);
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

function decrease(trainNote: TrainNote) {
  const stepper = new TrainNoteStepper(
    new WriteObserver(new TrainNoteWriter(new FrontmatterWriter()))
  );
  stepper.decrease(trainNote);
}

function SetPath(args: ChangePhaseArgs) {
  const activeDocument = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      return editor.document.uri.fsPath;
    }
  };

  if (!args.uri) {
    args.uri = activeDocument();
  }
}
