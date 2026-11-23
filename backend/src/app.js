const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const storageDirectory = path.join(__dirname, '../storage');
const documents = new Map();
const downloadRequests = new Map();
const downloadLimit = 60;
const downloadWindow = 60 * 1000;

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
    };
    documents.set(document.id, document);

    return res.status(201).json({ document });
  });
});

app.get('/documents', (_req, res) => {
  const publicDocuments = Array.from(documents.values());
  res.json({ documents: publicDocuments });
});

app.get('/documents/:id/download', (req, res, next) => {
  const now = Date.now();
  const clientIp = req.socket.remoteAddress || 'unknown';
  let requestWindow = downloadRequests.get(clientIp);

  if (!requestWindow || now - requestWindow.startedAt >= downloadWindow) {
    requestWindow = { startedAt: now, count: 0 };
  }
  if (requestWindow.count >= downloadLimit) {
    return res.status(429).json({ error: 'Limite de downloads excedido.' });
  }
  requestWindow.count += 1;
  downloadRequests.delete(clientIp);
  downloadRequests.set(clientIp, requestWindow);
  if (downloadRequests.size > 10000) {
    downloadRequests.delete(downloadRequests.keys().next().value);
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(404).json({ error: 'Documento não encontrado.' });
  }
  const document = documents.get(req.params.id);
  if (!document) {
    return res.status(404).json({ error: 'Documento não encontrado.' });
  }

  const filePath = path.join(storageDirectory, document.id);
  return res.download(filePath, document.originalName, (error) => {
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
