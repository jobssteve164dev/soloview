import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeCsv } from '../dist/csvEncoding.cjs';

const expected = '姓名,城市\n张三,北京\n備註,繁體中文';

test('CSV 自动识别无 BOM 的 UTF-8 中文', () => {
  const result = decodeCsv(new TextEncoder().encode(expected));
  assert.equal(result.encoding, 'utf-8');
  assert.equal(result.text, expected);
});

test('CSV 自动识别带 BOM 的 UTF-16 LE 中文', () => {
  const content = Buffer.from(expected, 'utf16le');
  const result = decodeCsv(new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), content])));
  assert.equal(result.encoding, 'utf-16le');
  assert.equal(result.text, expected);
});

test('CSV 自动识别 GBK / GB18030 简体中文', () => {
  const bytes = Uint8Array.from(Buffer.from('d0d5c3fb2cb3c7cad00ad5c5c8fd2cb1b1bea90a82e4d45d2cb7b1f377d6d0cec4', 'hex'));
  const result = decodeCsv(bytes);
  assert.equal(result.encoding, 'gb18030');
  assert.equal(result.text, expected);
});

test('CSV 自动识别 Big5 繁体中文，也允许用户明确选择', () => {
  const traditional = '姓名,城市\n張三,北京\n備註,繁體中文';
  const bytes = Uint8Array.from(Buffer.from('a96da6572cabb0a5ab0ab169a4542ca55fa8ca0ab3c6b5f92cc163c5e9a4a4a4e5', 'hex'));
  const detected = decodeCsv(bytes);
  const selected = decodeCsv(bytes, 'big5');
  assert.equal(detected.encoding, 'big5');
  assert.equal(detected.text, traditional);
  assert.equal(selected.text, traditional);
});
