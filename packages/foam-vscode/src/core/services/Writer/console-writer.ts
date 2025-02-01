import { IWriter } from './iwriter';

export class ConsoleWriter implements IWriter {
  public object: any;

  async write(): Promise<boolean> {
    const keys = Object.keys(this.object);
    const values = keys.map(key => `${key}: ${Reflect.get(this.object, key)}`);
    console.log(values);
    return true;
  }
}
