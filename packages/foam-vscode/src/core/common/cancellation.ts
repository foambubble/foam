/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// taken from https://github.com/microsoft/vscode/tree/master/src/vs/base/common

import { Emitter, Event } from './event';
import { IDisposable } from './lifecycle';

export interface CancellationToken {
  /**
   * A flag signalling is cancellation has been requested.
   */
  readonly isCancellationRequested: boolean;

  /**
   * An event which fires when cancellation is requested. This event
   * only ever fires `once` as cancellation can only happen once. Listeners
   * that are registered after cancellation will be called (next event loop run),
   * but also only once.
   *
   * @event
   */
  readonly onCancellationRequested: (
    listener: (e: any) => any,
    thisArgs?: any,
    disposables?: IDisposable[]
  ) => IDisposable;
}

const shortcutEvent: Event<any> = Object.freeze(function(
  callback,
  context?
): IDisposable {
  const handle = setTimeout(callback.bind(context), 0);
  return {
    dispose() {
      clearTimeout(handle);
    },
  };
});

export namespace CancellationToken {
  export function isCancellationToken(
    thing: unknown
  ): thing is CancellationToken {
    if (
      thing === CancellationToken.None ||
      thing === CancellationToken.Cancelled
    ) {
      return true;
    }
    if (thing instanceof MutableToken) {
      return true;
    }
    if (!thing || typeof thing !== 'object') {
      return false;
    }
    return (
      typeof (thing as CancellationToken).isCancellationRequested ===
        'boolean' &&
      typeof (thing as CancellationToken).onCancellationRequested === 'function'
    );
  }

  export const None: CancellationToken = Object.freeze({
    isCancellationRequested: false,
    onCancellationRequested: Event.None,
  });

  export const Cancelled: CancellationToken = Object.freeze({
    isCancellationRequested: true,
    onCancellationRequested: shortcutEvent,
  });
}

class MutableToken implements CancellationToken {
  private _isCancelled: boolean = false;
  private _emitter: Emitter<any> | null = null;

  public cancel() {
    if (!this._isCancelled) {
      this._isCancelled = true;
      if (this._emitter) {
        this._emitter.fire(undefined);
        this.dispose();
      }
    }
  }

  get isCancellationRequested(): boolean {
    return this._isCancelled;
  }

  get onCancellationRequested(): Event<any> {
    if (this._isCancelled) {
      return shortcutEvent;
    }
    if (!this._emitter) {
      this._emitter = new Emitter<any>();
    }
    return this._emitter.event;
  }

  public dispose(): void {
    if (this._emitter) {
      this._emitter.dispose();
      this._emitter = null;
    }
  }
}

export class CancellationTokenSource {
  private _token?: CancellationToken = undefined;
  private _parentListener?: IDisposable = undefined;

  constructor(parent?: CancellationToken) {
    this._parentListener =
      parent && parent.onCancellationRequested(this.cancel, this);
  }

  get token(): CancellationToken {
    if (!this._token) {
      // be lazy and create the token only when
      // actually needed
      this._token = new MutableToken();
    }
    return this._token;
  }

  cancel(): void {
    if (!this._token) {
      // save an object by returning the default
      // cancelled token when cancellation happens
      // before someone asks for the token
      this._token = CancellationToken.Cancelled;
    } else if (this._token instanceof MutableToken) {
      // actually cancel
      this._token.cancel();
    }
  }

  dispose(cancel: boolean = false): void {
    if (cancel) {
      this.cancel();
    }
    if (this._parentListener) {
      this._parentListener.dispose();
    }
    if (!this._token) {
      // ensure to initialize with an empty token if we had none
      this._token = CancellationToken.None;
    } else if (this._token instanceof MutableToken) {
      // actually dispose
      this._token.dispose();
    }
  }
}
