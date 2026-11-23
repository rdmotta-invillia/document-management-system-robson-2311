const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');
const documentController = require('../controllers/documentController');

const storagePath = path.resolve(__dirname, '../../storage');
fs.mkdirSync(storagePath, { recursive: true });

const documentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
});

const upload = multer({
  storage: multer.diskStorage({
    destination: storagePath,
    filename: (req, file, callback) => callback(null, randomUUID()),
  }),
});

const router = express.Router();

router.post(
  '/upload',
  documentRateLimit,
  upload.single('file'),
  documentController.upload,
);
router.get('/documents', documentController.list);
router.get(
  '/documents/:id/download',
  documentRateLimit,
  documentController.download,
);

module.exports = router;
