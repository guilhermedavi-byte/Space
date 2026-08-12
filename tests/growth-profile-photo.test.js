const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const {
  decodeBase64ImagePayload,
  transformProfilePhotoBuffer,
  OUTPUT_MIME,
  OUTPUT_SIZE_PX,
} = require('../api/_lib/profile-photo');

test('decodeBase64ImagePayload rejects empty payload', () => {
  assert.throws(() => decodeBase64ImagePayload(''), /missing_image_data/);
});

test('transformProfilePhotoBuffer recodes supported image to 400x400 webp', async () => {
  const input = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 255, g: 120, b: 80 },
    },
  }).png().toBuffer();

  const result = await transformProfilePhotoBuffer(input);
  assert.equal(result.outputMime, OUTPUT_MIME);
  const meta = await sharp(result.outputBuffer).metadata();
  assert.equal(meta.width, OUTPUT_SIZE_PX);
  assert.equal(meta.height, OUTPUT_SIZE_PX);
  assert.equal(meta.format, 'webp');
});

test('transformProfilePhotoBuffer rejects non-image payload', async () => {
  await assert.rejects(() => transformProfilePhotoBuffer(Buffer.from('not-an-image', 'utf8')), /unsupported_image_type|Input buffer contains unsupported image format/);
});
