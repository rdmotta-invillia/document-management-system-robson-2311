const path = require('node:path');
const documentService = require('../services/documentService');

const storagePath = path.resolve(__dirname, '../../storage');

function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  const document = documentService.create(req.file);
  return res.status(201).json(document);
}

function list(req, res) {
  return res.json(documentService.list());
}

function download(req, res, next) {
  const document = documentService.findById(req.params.id);
  if (!document) {
    return res.status(404).json({ error: 'Documento não encontrado.' });
  }

  const filePath = path.resolve(storagePath, path.basename(document.path));
  if (path.dirname(filePath) !== storagePath) {
    return res.status(404).json({ error: 'Documento não encontrado.' });
  }

  return res.download(filePath, document.originalName, (error) => {
    if (error && !res.headersSent) {
      next(error);
    }
  });
}

module.exports = { upload, list, download };
