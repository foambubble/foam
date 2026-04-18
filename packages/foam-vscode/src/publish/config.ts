import { Resource } from '../core/model/note';
import { PublishConfig, PublishIncludeMatcher } from './types';

export const getIncludeMatcher = (config: PublishConfig): PublishIncludeMatcher => {
  return (
    config.include ??
    ((resource: Resource) => {
      return resource.type === 'note';
    })
  );
};
