import { IWriter } from '../services/Writer/iwriter';

export interface Observer {
  update: (object: any) => void;
}

export class WriteObserver implements Observer {
  writer: IWriter;

  constructor(writer: IWriter) {
    this.writer = writer;
  }

  update(object: any): void {
    this.writer.write(object);
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
