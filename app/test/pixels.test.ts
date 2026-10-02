import assert from 'node:assert/strict';
import { test } from 'node:test';
import { centerSquare, channelLayout, toModelInput } from '../src/ml/pixels.ts';

test('RGBA → float32 RGB без нормализации', () => {
  const px = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]); // 2×1
  const out = new Float32Array(toModelInput(px.buffer, 2, 1, 'RGBA', { size: 2, dtype: 'float32', normalization: 'raw255' }));
  assert.deepEqual(Array.from(out), [10, 20, 30, 40, 50, 60]);
});

test('BGRA (iOS) переставляет каналы', () => {
  const px = new Uint8Array([30, 20, 10, 255]);
  const out = new Uint8Array(toModelInput(px.buffer, 1, 1, 'BGRA', { size: 1, dtype: 'uint8', normalization: 'raw255' }));
  assert.deepEqual(Array.from(out), [10, 20, 30]);
});

test('нормализация [-1, 1] и [0, 1]', () => {
  const px = new Uint8Array([0, 255, 127.5, 255]);
  const a = new Float32Array(toModelInput(px.buffer, 1, 1, 'RGBA', { size: 1, dtype: 'float32', normalization: 'minus_one_one' }));
  assert.equal(a[0], -1);
  assert.equal(a[1], 1);
  const b = new Float32Array(toModelInput(px.buffer, 1, 1, 'RGBA', { size: 1, dtype: 'float32', normalization: 'zero_one' }));
  assert.equal(b[1], 1);
});

test('учитывается выравнивание строк (stride больше ширины)', () => {
  // 1×2, строка 8 байт: 4 байта пикселя + 4 байта выравнивания
  const px = new Uint8Array([1, 2, 3, 255, 0, 0, 0, 0, 4, 5, 6, 255, 0, 0, 0, 0]);
  const out = new Uint8Array(toModelInput(px.buffer, 1, 2, 'RGBA', { size: 1, dtype: 'uint8', normalization: 'raw255' }));
  assert.deepEqual(Array.from(out), [1, 2, 3, 4, 5, 6]);
});

test('центральный квадрат', () => {
  assert.deepEqual(centerSquare(4000, 3000), { x: 500, y: 0, side: 3000 });
  assert.deepEqual(centerSquare(3000, 4000), { x: 0, y: 500, side: 3000 });
});

test('неизвестный формат — ошибка', () => {
  assert.throws(() => channelLayout('unknown'));
});
