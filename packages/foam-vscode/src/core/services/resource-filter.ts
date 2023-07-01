import { negate } from 'lodash';
import { Resource } from '../model/note';

export interface FilterDescriptor
  extends FilterDescriptorOp,
    FilterDescriptorParam {}

interface FilterDescriptorOp {
  and?: FilterDescriptor[];
  or?: FilterDescriptor[];
  not?: FilterDescriptor;
}

interface FilterDescriptorParam {
  /**
   * A regex of the path to include
   */
  path?: string;

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

  /**
   * An expression to evaluate to JS, use `resource` to reference the resource object
   */
  expression?: string;
}

type ResourceFilter = (r: Resource) => boolean;

export function createFilter(
  filter: FilterDescriptor,
  enableCode: boolean
): ResourceFilter {
  filter = filter ?? {};
  const expressionFn =
    enableCode && filter.expression
      ? resource => eval(filter.expression) // eslint-disable-line no-eval
      : undefined;
  return resource => {
    if (expressionFn && !expressionFn(resource)) {
      return false;
    }
    if (filter.path && !resource.uri.path.match(filter.path)) {
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
        .map(pred => createFilter(pred, enableCode))
        .every(fn => fn(resource));
    }
    if (filter.or) {
      return filter.or
        .map(pred => createFilter(pred, enableCode))
        .some(fn => fn(resource));
    }
    if (filter.not) {
      return negate(createFilter(filter.not, enableCode))(resource);
    }
    return true;
  };
}
