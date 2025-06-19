import { URI } from '../../model/uri';

export interface IWriter {
  write: (object: { uri: URI }) => Promise<void>;
}
