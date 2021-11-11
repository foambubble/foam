export class UserCancelledOperation extends Error {
  constructor(message?: string) {
    super('UserCancelledOperation');
    if (message) {
      this.message = message;
    }
  }
}
