const documents = new Map();

function create(document) {
  documents.set(document.id, document);
  return document;
}

function findAll() {
  return [...documents.values()];
}

function findById(id) {
  return documents.get(id);
}

module.exports = { create, findAll, findById };
