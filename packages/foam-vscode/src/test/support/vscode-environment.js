const NodeEnvironment = require('jest-environment-node');
const vscode = require('vscode');

class VscodeEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();
    this.global.vscode = vscode;

    // Expose RegExp otherwise document.getWordRangeAtPosition won't work as supposed.
    // Implementation of getWordRangeAtPosition uses "instanceof RegExp" which returns false
    // due to Jest running tests in the different vm context.
    // See https://github.com/nodejs/node-v0.x-archive/issues/1277.
    // And also https://github.com/microsoft/vscode-test/issues/37#issuecomment-700167820
    this.global.RegExp = RegExp;

    vscode.workspace
      .getConfiguration()
      .update('foam.edit.linkReferenceDefinitions', 'off');
  }

  async teardown() {
    this.global.vscode = {};
    await super.teardown();
  }
}

module.exports = VscodeEnvironment;
