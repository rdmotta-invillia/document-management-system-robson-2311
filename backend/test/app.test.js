const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../src/app');

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('faz upload, lista e baixa um documento', async () => {
  const storagePath = path.resolve(__dirname, '../storage');
  const existingFiles = new Set(fs.readdirSync(storagePath));
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const form = new FormData();
    form.append('file', new Blob(['conteúdo do documento']), 'documento.txt');
    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: form,
    });

    assert.strictEqual(uploadResponse.status, 201);
    const uploadedDocument = await uploadResponse.json();
    assert.strictEqual(uploadedDocument.originalName, 'documento.txt');
    assert.strictEqual(
      uploadedDocument.size,
      Buffer.byteLength('conteúdo do documento'),
    );

    const listResponse = await fetch(`${baseUrl}/documents`);
    assert.strictEqual(listResponse.status, 200);
    const documents = await listResponse.json();
    assert.ok(documents.some(({ id }) => id === uploadedDocument.id));

    const downloadResponse = await fetch(
      `${baseUrl}/documents/${uploadedDocument.id}/download`,
    );
    assert.strictEqual(downloadResponse.status, 200);
    assert.strictEqual(await downloadResponse.text(), 'conteúdo do documento');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    for (const file of fs.readdirSync(storagePath)) {
      if (!existingFiles.has(file)) {
        fs.rmSync(path.join(storagePath, file), { force: true });
      }
    }
  }
});
