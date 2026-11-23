const { randomUUID } = require('node:crypto');
const documentRepository = require('../repositories/documentRepository');

function create(file) {
  const document = documentRepository.create({
    id: randomUUID(),
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner: 'anonymous',
    path: file.path,
  });

  return toPublicDocument(document);
}

function list() {
  return documentRepository.findAll().map(toPublicDocument);
}

function findById(id) {
  return documentRepository.findById(id);
}

function toPublicDocument({ path: filePath, ...document }) {
  return document;
}

module.exports = { create, list, findById };
