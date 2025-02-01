export interface IWriter {
  object: any;
  write: () => Promise<boolean>;
}
