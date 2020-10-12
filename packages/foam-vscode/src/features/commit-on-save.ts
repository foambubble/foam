import { commands, ExtensionContext, TextDocument, workspace, extensions } from "vscode";
import { GitExtension, Commit } from "../git";
import { FoamFeature } from "../types";
import { exec } from 'child_process';
import { promisify } from 'util';

const execP = promisify(exec);
let latestCommitTime;
let latestSyncTime;
let commitInterval = 10; // replace with configuration
let syncInterval = 60 * 5;

const feature: FoamFeature = {
  activate: (context: ExtensionContext) => {
    context.subscriptions.push(
      commands.registerCommand("foam-vscode.run-hook-on-save", commitOnSave)
    );
    workspace.onDidSaveTextDocument((document: TextDocument) => {
      commands.executeCommand("foam-vscode.run-hook-on-save", document);
    });
  }
};

async function commitOnSave (document: TextDocument) {
  let amend = false;

  const gitExtension = extensions.getExtension<GitExtension>('vscode.git').exports;
  const git = gitExtension.getAPI(1);
  // get current repo instance
  const repo = git.repositories[0];
  // stage current document
  await execP(`git add ${document.fileName}`, { cwd: repo.rootUri.path });
  // get current status (should be one file)
  const statusCmd = await execP(`git status -s`, { cwd: repo.rootUri.path });
  const status = statusCmd.stdout.trim().split('\n');
  // get array of filenames of staged files
  const filesInStage = status.reduce((acc, cur) => {
    // first argument is file status more details: https://git-scm.com/docs/git-status#_short_format
    const [, filename] = cur.split('  ');
    if (filename) {
      acc.push(filename);
    }

    return acc;
  }, []);
  // get latest commit edited file names
  const showCmd = await execP(`git show --numstat --oneline`, { cwd: repo.rootUri.path });
  const show = showCmd.stdout.trim().split('\n');
  const latestCommitHash = show[0].split(' ')[0];
  // get array of filenames of latest commit
  const filesInLatestCommit = show.reduce((acc, cur) => {
    const [,, filename] = cur.split('	');
    if (filename) {
      acc.push(filename);
    } return acc;
  }, []);

  // before checking for ammend commit we should check if latest commit if already pushed
  const branchCmd = await execP(`git branch -r --contains ${latestCommitHash}`, { cwd: repo.rootUri.path });
  const branch = branchCmd.stdout.trim().split('\n');

  if (
    branch.length === 0 // latest commit isn't pushed
    && filesInStage.length === 1 // only one file in stage
    && filesInLatestCommit.length === 1 // only one file in latest commit
    && filesInStage[0] === filesInLatestCommit[0] // files are same
    && isDatesInSameInterval(new Date(), latestCommitTime, commitInterval) // check if latest commit included in time interval
  ) {
    amend = true;
  }

  await repo.commit(`${(new Date).toLocaleTimeString()}`, { amend });
  // write commit time
  latestCommitTime = new Date();

  if (!isDatesInSameInterval(new Date(), latestSyncTime, syncInterval)) {
  const pullCmd = await execP(`git pull`, { cwd: repo.rootUri.path });
  console.info('pull', pullCmd);
  const pushCmd = await execP(`git push`, { cwd: repo.rootUri.path });
  console.info('push', pushCmd);

    // write latest sync time
    latestSyncTime = new Date();
  }
}

/**
 * @param date new date
 * @param prevDate latest date
 * @param diffence in seconds
 */
function isDatesInSameInterval(date: Date, prevDate: Date, interval: number): boolean {
  if (!date || !prevDate) {
    return false;
  }
  const getSeconds = (date: Date): number => +((date.getTime() / 1000).toFixed(0));
  return (getSeconds(date) - getSeconds(prevDate)) <= interval;
}

export default feature;
