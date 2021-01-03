// Based on https://github.com/svsool/vscode-memo/blob/master/src/test/env/ExtendedVscodeEnvironment.js
const VscodeEnvironment = require("jest-environment-vscode");

class ExtendedVscodeEnvironment extends VscodeEnvironment {
  async setup() {
    await super.setup();
    // Expose RegExp otherwise document.getWordRangeAtPosition won't work as supposed.
    // Implementation of getWordRangeAtPosition uses "instanceof RegExp" which returns false
    // due to Jest running tests in the different vm context.
    // See https://github.com/nodejs/node-v0.x-archive/issues/1277.
    this.global.RegExp = RegExp;
  }
}

module.exports = ExtendedVscodeEnvironment;
