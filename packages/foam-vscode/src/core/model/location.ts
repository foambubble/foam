import { Range } from './range';
import { URI } from './uri';
import { ResourceLink } from './note';

/**
 * Represents a location inside a resource, such as a line
 * inside a text file.
 */
export interface Location<T> {
  /**
   * The resource identifier of this location.
   */
  uri: URI;
  /**
   * The document range of this locations.
   */
  range: Range;
  /**
   * The data associated to this location.
   */
  data: T;
}

export abstract class Location<T> {
  static create<T>(uri: URI, range: Range, data: T): Location<T> {
    return { uri, range, data };
  }

  static forObjectWithRange<T extends { range: Range }>(
    uri: URI,
    obj: T
  ): Location<T> {
    return Location.create(uri, obj.range, obj);
  }
}
