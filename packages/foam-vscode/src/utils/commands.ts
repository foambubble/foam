import { Uri } from 'vscode';
import { merge } from 'lodash';

export interface CommandDescriptor<T> {
  name: string;
  params: T;
}

export function describeCommand<T>(
  base: CommandDescriptor<T>,
  ...extra: Partial<T>[]
) {
  return merge(base, ...extra.map(e => ({ params: e })));
}

export function commandAsURI<T>(command: CommandDescriptor<T>) {
  return Uri.parse(`command:${command.name}`).with({
    query: encodeURIComponent(JSON.stringify(command.params)),
  });
}
