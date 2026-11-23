const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-test-'));
process.env.DOCUMENT_STORAGE_DIR = storageDir;

const app = require('../src/app');
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  fs.rmSync(storageDir, { recursive: true, force: true });
});

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('upload, listagem e download de documentos', async () => {
  const form = new FormData();
  form.append('file', new Blob(['conteúdo do documento'], { type: 'text/plain' }), 'documento.txt');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: form,
    headers: { 'x-user-id': 'usuario-teste' },
  });
  assert.equal(uploadResponse.status, 201);
  const uploaded = await uploadResponse.json();
  assert.equal(uploaded.originalName, 'documento.txt');
  assert.equal(uploaded.size, Buffer.byteLength('conteúdo do documento'));
  assert.equal(uploaded.owner, 'usuario-teste');
  assert.ok(uploaded.id);

  const listResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), [uploaded]);

  const downloadResponse = await fetch(`${baseUrl}/documents/${uploaded.id}/download`);
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /documento\.txt/);
  assert.equal(await downloadResponse.text(), 'conteúdo do documento');

  const missingDownloadResponse = await fetch(`${baseUrl}/documents/inexistente/download`);
  assert.equal(missingDownloadResponse.status, 404);
});
