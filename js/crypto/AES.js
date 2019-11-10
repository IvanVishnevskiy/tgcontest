import AES from 'crypto-js/aes'
import padding from 'crypto-js/pad-zeropadding'
import CTR from 'crypto-js/mode-ctr'

import { bytesToWords, bytesFromWords, addPadding } from '../helpers/bytes'

import core from 'crypto-js/core'

const IGE = (function () {
  /**
   * Abstract base IGE mode.
   */
  var IGE = core.lib.BlockCipherMode.extend();

  /**
   * IGE encryptor.
   */
  IGE.Encryptor = IGE.extend({
      /**
       * Processes the data block at offset.
       *
       * @param {Array} words The data words to operate on.
       * @param {number} offset The offset where the block starts.
       *
       * @example
       *
       *     mode.processBlock(data.words, offset);
       */
      processBlock: function (words, offset) {
          // Shortcuts
          var cipher = this._cipher;
          var blockSize = cipher.blockSize;

          if (this._ivp === undefined) {
            this._ivp = this._iv.slice(0, blockSize);
            this._iv2p = this._iv.slice(blockSize, blockSize + blockSize);
          }


          // Remember this block to use with next block
          var nextIv2p = words.slice(offset, offset + blockSize);

          // XOR with previous ciphertext
          xorBlock(words, this._ivp, offset, blockSize);

          // Block cipher
          cipher.encryptBlock(words, offset);

          // XOR with previous plaintext
          xorBlock(words, this._iv2p, offset, blockSize);

          this._ivp = words.slice(offset, offset + blockSize);
          this._iv2p = nextIv2p;
      }
  });

  /**
   * IGE decryptor.
   */
  IGE.Decryptor = IGE.extend({
      /**
       * Processes the data block at offset.
       *
       * @param {Array} words The data words to operate on.
       * @param {number} offset The offset where the block starts.
       *
       * @example
       *
       *     mode.processBlock(data.words, offset);
       */
      processBlock: function (words, offset) {
          // Shortcuts
          var cipher = this._cipher;
          var blockSize = cipher.blockSize;

          if (this._ivp === undefined) {
            this._ivp = this._iv.slice(0, blockSize);
            this._iv2p = this._iv.slice(blockSize, 2 * blockSize);
          }

          // Remember this block to use with next block
          var nextIvp = words.slice(offset, offset + blockSize);

          // XOR with previous ciphertext
          xorBlock(words, this._iv2p, offset, blockSize);

          // Block cipher
          cipher.decryptBlock(words, offset);

          // XOR with previous plaintext
          xorBlock(words, this._ivp, offset, blockSize);

          this._ivp = nextIvp;
          this._iv2p = words.slice(offset, offset + blockSize);
      }
  });

  function xorBlock(words, block, offset, blockSize) {
      for (var i = 0; i < blockSize; i++) {
          words[offset + i] ^= block[i];
      }
  }

  return IGE
}())


const decrypt = (encryptedBytes, keyBytes, ivBytes, ws) => {
  var decryptedWords = AES.decrypt({ciphertext: bytesToWords(encryptedBytes)}, bytesToWords(keyBytes), {
    iv: bytesToWords(ivBytes),
    padding,
    mode: ws ? CTR : IGE
  })

  return bytesFromWords(decryptedWords)
}

const encrypt = (bytes, keyBytes, ivBytes, ws) => {

  bytes = addPadding(bytes)

  const encryptedWords = AES.encrypt(bytesToWords(bytes), bytesToWords(keyBytes), {
    iv: bytesToWords(ivBytes),
    padding,
    mode: ws ? CTR : IGE
  })
  return bytesFromWords(encryptedWords)
}

const encryptWS = (...params) => encrypt(...params, true)
const decryptWS = (...params) => decrypt(...params, true)

export default { decrypt, encrypt, encryptWS, decryptWS }
