const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const path = require('node:path');
const app = require('../src/app');

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('upload, listagem e download de documentos', async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const content = 'conteúdo do documento';
  let uploadedDocument;

  await t.test('faz upload de um documento', async () => {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'text/plain' }), 'documento.txt');

    const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
    assert.strictEqual(response.status, 201);
    ({ document: uploadedDocument } = await response.json());
    assert.strictEqual(uploadedDocument.originalName, 'documento.txt');
    assert.strictEqual(uploadedDocument.size, Buffer.byteLength(content));
    assert.strictEqual(uploadedDocument.owner, null);
    assert.ok(uploadedDocument.id);
    assert.ok(uploadedDocument.uploadedAt);
    assert.ok(await fs.stat(path.join(__dirname, '../storage', uploadedDocument.id)));
  });

  await t.test('lista documentos sem expor o caminho do arquivo', async () => {
    const response = await fetch(`${baseUrl}/documents`);
    assert.strictEqual(response.status, 200);
    const { documents } = await response.json();
    assert.deepStrictEqual(documents, [uploadedDocument]);
    assert.ok(!Object.hasOwn(documents[0], 'filePath'));
  });

  await t.test('baixa o documento pelo identificador', async () => {
    const response = await fetch(`${baseUrl}/documents/${uploadedDocument.id}/download`);
    assert.strictEqual(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /documento\.txt/);
    assert.strictEqual(await response.text(), content);
  });

  await t.test('retorna 404 para documento inexistente', async () => {
    const response = await fetch(`${baseUrl}/documents/inexistente/download`);
    assert.strictEqual(response.status, 404);
  });

  await t.test('rejeita upload sem arquivo', async () => {
    const response = await fetch(`${baseUrl}/upload`, { method: 'POST' });
    assert.strictEqual(response.status, 400);
  });

  await t.test('rejeita arquivos maiores que 10 MiB sem armazenar arquivo parcial', async () => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), 'grande.txt');

    const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
    assert.strictEqual(response.status, 413);
    const storedFiles = (await fs.readdir(path.join(__dirname, '../storage')))
      .filter((file) => file !== '.gitkeep');
    assert.deepStrictEqual(
      storedFiles,
      [uploadedDocument.id],
    );
  });

  await t.test('limita downloads excessivos por endereço', async () => {
    for (let request = 0; request < 59; request += 1) {
      const response = await fetch(`${baseUrl}/documents/${uploadedDocument.id}/download`);
      assert.strictEqual(response.status, request < 58 ? 200 : 429);
      await response.arrayBuffer();
    }
  });

  t.after(async () => {
    if (uploadedDocument) {
      await fs.rm(path.join(__dirname, '../storage', uploadedDocument.id), { force: true });
    }
  });
});
