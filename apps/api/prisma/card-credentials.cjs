const { randomBytes, randomInt, createCipheriv, createDecipheriv } = require('node:crypto');
function keyBuffer(key) {
  if (!/^[a-f0-9]{64}$/i.test(key ?? ''))
    throw new Error('CARD_ENCRYPTION_KEY must be 32 bytes encoded as hex. Run npm run setup.');
  return Buffer.from(key, 'hex');
}
function encrypt(value, key, context) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer(key), nonce);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [nonce, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}
function decrypt(value, key, context) {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Invalid synthetic credential envelope.');
  const [nonce, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', keyBuffer(key), nonce);
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString('utf8');
}
function luhnValid(number) {
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let digit = Number(number[number.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
function createCredential(cardId, key, previousLast4) {
  let number;
  do {
    number = '0000' + Array.from({ length: 12 }, () => randomInt(10)).join('');
    if (luhnValid(number)) number = number.slice(0, -1) + String((Number(number.at(-1)) + 1) % 10);
  } while (number.slice(-4) === previousLast4);
  const cvv = String(randomInt(1000)).padStart(3, '0');
  return {
    last4: number.slice(-4),
    encryptedNumber: encrypt(number, key, `${cardId}:number`),
    encryptedCvv: encrypt(cvv, key, `${cardId}:cvv`),
  };
}
function revealCredential(cardId, key, record) {
  return {
    number: decrypt(record.encryptedNumber, key, `${cardId}:number`),
    cvv: decrypt(record.encryptedCvv, key, `${cardId}:cvv`),
  };
}
module.exports = { createCredential, revealCredential, luhnValid };
