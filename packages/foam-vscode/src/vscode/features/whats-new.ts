import { ExtensionContext, Uri, commands, window, workspace } from 'vscode';
import { hash } from '@foam/core';

export const WHATS_NEW_LAST_SEEN_KEY = 'foam.whatsNew.lastSeen';

/**
 * Extracts the h1 heading text from WHATS_NEW.md content.
 * Used as the notification title. Returns undefined if no h1 heading is found.
 */
export function parseWhatsNewTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1].trim();
}

/**
 * Computes a hash of the file content.
 * Any change to the file produces a different hash, triggering a new notification.
 */
export function computeContentHash(content: string): string {
  return hash(content);
}

/**
 * Reads WHATS_NEW.md from the extension directory.
 * Returns undefined if the file does not exist.
 */
export async function readWhatsNewFile(
  extensionUri: Uri
): Promise<string | undefined> {
  const fileUri = Uri.joinPath(extensionUri, 'WHATS_NEW.md');
  try {
    const bytes = await workspace.fs.readFile(fileUri);
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return undefined;
  }
}

export async function showWhatsNew(extensionUri: Uri) {
  const uri = Uri.joinPath(extensionUri, 'WHATS_NEW.md');
  await commands.executeCommand('markdown.showPreview', uri);
}

export default async function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand('foam-vscode.show-whats-new', () =>
      showWhatsNew(context.extensionUri)
    )
  );

  const content = await readWhatsNewFile(context.extensionUri);
  if (!content) {
    return;
  }

  const contentHash = computeContentHash(content);
  const lastSeen = context.globalState.get<string>(WHATS_NEW_LAST_SEEN_KEY);
  if (lastSeen === contentHash) {
    return;
  }

  await context.globalState.update(WHATS_NEW_LAST_SEEN_KEY, contentHash);

  const title = parseWhatsNewTitle(content);
  const message = title ? `What's new in Foam: ${title}` : "What's new in Foam";

  // Fire-and-forget: the notification must not block extension activation,
  // because activate() is awaited by Promise.all in extension.ts.
  // If we awaited here, the extension would never finish activating until
  // the user clicks a button.
  window.showInformationMessage(message, 'Show me', 'Dismiss').then(choice => {
    if (choice === 'Show me') {
      showWhatsNew(context.extensionUri);
    }
  });
}
