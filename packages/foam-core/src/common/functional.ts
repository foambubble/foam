/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// taken from https://github.com/microsoft/vscode/tree/master/src/vs/base/common

export function once<T extends Function>(this: unknown, fn: T): T {
  const _this = this;
  let didCall = false;
  let result: unknown;

  return (function() {
    if (didCall) {
      return result;
    }

    didCall = true;
    result = fn.apply(_this, arguments);

    return result;
  } as unknown) as T;
}
