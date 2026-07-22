import assert from 'node:assert/strict';
import test from 'node:test';
import documentTypes from '../dist/documentTypes.cjs';

const { documentTypeForPath } = documentTypes;

test('recognizes every supported document and image type case-insensitively', () => {
  for (const type of ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']) {
    assert.equal(documentTypeForPath(`/tmp/example.${type.toUpperCase()}`), type);
  }
});

test('does not claim unsupported formats', () => {
  assert.equal(documentTypeForPath('/tmp/example.ppt'), undefined);
  assert.equal(documentTypeForPath('/tmp/example.doc'), undefined);
  assert.equal(documentTypeForPath('/tmp/example.tiff'), undefined);
});
