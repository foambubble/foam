export interface IWriter {
  write: (object: any) => Promise<boolean>;
}
