import { Resource } from '../../core/model/note';
import { PublishContext } from '../types';

export const collectPublishedResources = (context: PublishContext): Resource[] =>
  context.workspace.list().filter(resource => {
    if (resource.type !== 'note') {
      return true;
    }

    return context.include(resource);
  });

export const collectPublishedNotes = (context: PublishContext): Resource[] =>
  collectPublishedResources(context).filter(resource => resource.type === 'note');
