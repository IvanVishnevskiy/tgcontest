import bigInt from 'big-integer'
import { bytesFromHex } from './bytes'

class Serialization {
  items = []
  bytes = []
  store = arrs => {
    this.items = this.items.concat(arrs)
    arrs.forEach(arr => arr.forEach(item => this.bytes.push(item)))
  }

  static hex(hex) {
    const length = hex.length
    let start = 0
    const bytes = []
    if(length % 2) { bytes.push(parseInt(hex.charAt(0), 16)); start++ }
    for(let i = start; i < length; i += 2) 
      bytes.push(parseInt(hex.substr(i, 2), 16))
    
    return bytes
  }
  static bytes = bytes => bytes
  static paddingBytes = (bytes, padding = 4) => this.padding(this.bytes(bytes), padding)
  static paddingInt = int => this.padding(this.int(int))
  static int = int => this.hex(Number(int).toString(16))
  static padding = (arr, blockSize = 4) => this.addPadding(arr, blockSize)
  static buffer = buffer => [...new Uint8Array(buffer)]
  static name = name => this.hex(name).reverse()
  static bigInt = bigint => this.hex(bigInt(bigint).toString(16)).reverse()
  static words = wordArray => {
    const words = wordArray.words || wordArray.ciphertext.words
    const sigBytes = wordArray.sigBytes || wordArray.ciphertext.sigBytes
    const bytes = []

    for(let i = 0; i < sigBytes; i++) bytes.push((words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff)
    return bytes
  }
  static xor = (b1, b2) => {
    const bytes = []
    for(let i = 0; i < b1.length; i++) bytes[i] = b1[i] ^ b2[i]
    return bytes
  }
  static addPadding = (bytes, blockSize = 16) => {
    const length = bytes.byteLength || bytes.length
    const needPadding = blockSize - (length % blockSize)
    if(needPadding> 0 && needPadding < blockSize) {
      const padding = new Array(needPadding)
      for(let i = 0; i < needPadding; i++) padding[i] = 0
      bytes = bytes.concat(padding)
    }
    return bytes
  }
  static string = (string = '') => {
    let res = []
    const sUTF8 = unescape(encodeURIComponent(string))
    const length = sUTF8.length
    if (length <= 253) 
      res.push(length)
    
    else res = res.concat([254, length & 0xFF, (length & 0xFF00) >> 8, (length & 0xFF0000) >> 16]).reverse()
    for (let i = 0; i < length; i++) res.push(sUTF8.charCodeAt(i))
    while (res.length % 4 !== 0) res.push(0) // padding
    return res
  }
  static byteString = (byteString = []) => {
    let res = []
    const length = byteString.length
    if(length >= 254) { res = [254].concat([0, ...bytesFromHex(byteString.length.toString(16))].reverse()); res.length = 4 }
    else res.push(byteString.length)
    if(res.length < 4) while(res.length < 4) res.push(0)
    return res.concat(byteString)
  }
  getBytes = () => this.bytes
  getBuffer = () => new Uint8Array(this.bytes).buffer
}

class Deserialization {

}

export { Serialization }