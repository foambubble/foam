import { URI } from '../model/uri';
import { IWriter } from '../services/Writer/iwriter';

export interface Observer {
  update: (object: any) => void;
}

export class WriteObserver implements Observer {
  writer: IWriter;

  constructor(writer: IWriter) {
    this.writer = writer;
  }

  update(object: { uri: URI }): void {
    this.writer.write(object, object.uri);
  }
}

export class Subject {
  private observer: Observer;

  Attach(observer: Observer): void {
    this.observer = observer;
  }

  Detach() {
    this.observer = null;
  }

  Notify() {
    this.observer.update(this);
  }
}
