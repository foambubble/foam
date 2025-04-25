import { URI } from '../../model/uri';

export interface IWriter {
  write: (object: any, uri: URI) => Promise<void>;
}
