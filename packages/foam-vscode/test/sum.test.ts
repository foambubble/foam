// Kept in to make sure tests are running for foam-vscode
function sum(a, b) {
  return a + b;
}

describe("This test ensures Jest is working properly", () => {
  test("adds 1 + 2 to equal 3", () => {
    expect(sum(1, 2)).toBe(3);
  });
});
