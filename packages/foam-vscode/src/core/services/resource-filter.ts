import * as _ from 'lodash';
import { Resource } from '../model/note';

type ResourceFilter = (r: Resource) => boolean;

export function createFilter(filter: FilterDescriptor): ResourceFilter {
  return resource => {
    if (filter.exclude && resource.uri.toFsPath().match(filter.exclude)) {
      return false;
    }
    if (filter.type && resource.type !== filter.type) {
      return false;
    }
    if (filter.title && !resource.title.match(filter.title)) {
      return false;
    }
    if (filter.and) {
      return filter.and
        .map(pred => createFilter(pred))
        .every(fn => fn(resource));
    }
    if (filter.or) {
      return filter.or.map(pred => createFilter(pred)).some(fn => fn(resource));
    }
    if (filter.not) {
      return _.negate(createFilter(filter.not))(resource);
    }
    return true;
  };
}

interface FilterDescriptorOp {
  and?: FilterDescriptor[];
  or?: FilterDescriptor[];
  not?: FilterDescriptor;
}

interface FilterDescriptorParam {
  /**
   * A glob of the notes to include
   */
  include?: string;

  /**
   * A glob of the notes to exclude
   */
  exclude?: string;

  /**
   * A tag
   */
  tag?: string;

  /**
   * A note type
   */
  type?: string;

  /**
   * The title of the note
   */
  title?: string;
}

export interface FilterDescriptor
  extends FilterDescriptorOp,
    FilterDescriptorParam {}
