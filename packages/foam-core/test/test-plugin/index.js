const middleware = next => ({
  setNote: note => {
    note.properties['injectedByMiddleware'] = true;
    return next.setNote(note);
  },
});

const parser = {
  visit: (node, note) => {
    if (node.type === 'heading') {
      note.properties.hasHeading = true;
    }
  },
};

module.exports = {
  name: 'Test Plugin',
  graphMiddleware: middleware,
  parser: parser,
};
