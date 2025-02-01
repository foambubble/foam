import { IWriter } from './iwriter';

export class ConsoleWriter implements IWriter {
  async write(object: any): Promise<boolean> {
    const keys = Object.keys(object);
    const values = keys
      .map(key => `${key}: ${Reflect.get(object, key)}`)
      .join(', \n');
    console.log(values);
    return true;
  }
}
