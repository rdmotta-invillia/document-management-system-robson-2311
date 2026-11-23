const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const storageDirectory = path.join(__dirname, '../storage');
const documents = new Map();

fs.mkdirSync(storageDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, storageDirectory),
    filename: (_req, _file, callback) => callback(null, crypto.randomUUID()),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/upload', (req, res, next) => {
  upload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: error.message });
    }
    if (error) {
      return next(error);
    }
    if (!req.file) {
      return res.status(400).json({ error: 'É necessário enviar um arquivo.' });
    }

    const document = {
      id: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      owner: null,
      filePath: req.file.path,
    };
    documents.set(document.id, document);

    const { filePath, ...publicDocument } = document;
    return res.status(201).json({ document: publicDocument });
  });
});

app.get('/documents', (_req, res) => {
  const publicDocuments = Array.from(documents.values(), ({ filePath, ...document }) => document);
  res.json({ documents: publicDocuments });
});

app.get('/documents/:id/download', (req, res, next) => {
  const document = documents.get(req.params.id);
  if (!document) {
    return res.status(404).json({ error: 'Documento não encontrado.' });
  }

  return res.download(document.filePath, document.originalName, (error) => {
    if (!error || res.headersSent) {
      return;
    }
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }
    return next(error);
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
