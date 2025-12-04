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
    this.writer.write(object);
  }
}

export class Notifier {
  private observer: Observer;

  Attach(observer: Observer): void {
    if (observer) {
      this.observer = observer;
    }
  }

  Detach() {
    this.observer = null;
  }

  Notify(object: { uri: URI }) {
    if (this.observer) {
      this.observer.update(object);
    }
  }
}
