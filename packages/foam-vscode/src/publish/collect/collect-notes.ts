import { Resource } from '../../core/model/note';
import { PublishContext } from '../types';

export const collectPublishedResources = (context: PublishContext): Resource[] =>
  context.resources;

export const collectPublishedNotes = (context: PublishContext): Resource[] =>
  context.notes;
