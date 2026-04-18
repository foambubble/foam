import { Resource } from '../core/model/note';
import { PublishConfig } from './types';

export const getIncludeMatcher = (config: PublishConfig) => {
  return config.include ?? ((resource: Resource) => resource.type === 'note');
};
