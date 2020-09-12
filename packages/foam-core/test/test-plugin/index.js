const middleware = next => ({
  setNote: note => {
    note.properties['injected'] = true;
    return next.setNote(note);
  },
});

module.exports = {
  name: 'Test Plugin',
  graphMiddleware: middleware,
};
