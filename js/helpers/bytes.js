import Rusha from 'rusha'

import { toByteArray } from './BigInt'

let rushaInstance

const compareBytes = (b1 = [], b2 = []) => {
  const length = b1.length
  if(length !== b2.length) return false

  for(let i = 0; i < length; i++) {
    if(b1[i] !== b2[i]) return false
  }
  return true
}

const bytesToHex = (b = []) => 
  b.map(byte => ('0' + byte.toString(16)).slice(-2), 16).join('')

const bytesFromHex = (hex = '') => {
  const length = hex.length

  let start = 0
  const bytes = []

  if(length % 2) {
    bytes.push(parseInt(hex.charAt(0), 16))
    start++
  }

  for(let i = start; i < length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16))
  }

  return bytes
}

const bytesFromArrayBuffer = b => {
  const length = b.byteLength
  const byteView = new Uint8Array(b)
  const bytes = []
  
  for(var i = 0; i < length; i++) {
    bytes[i] = byteView[i]
  }

  return bytes
}

const sha1Hash = b => {
  rushaInstance = rushaInstance || new Rusha(1024 * 1024)
  const hashBytes = rushaInstance.rawDigest(b).buffer
  return hashBytes
}

const sha1Bytes = b => bytesFromArrayBuffer(sha1Hash(b))

const addPadding = (bytes, blockSize = 16) => {
  const length = bytes.byteLength || bytes.length
  const needPadding = blockSize - (length % blockSize)
  if(needPadding> 0 && needPadding < blockSize) {
    const padding = new Array(needPadding)
    for(let i = 0; i < needPadding; i++) {
      padding[i] = 0
    }
    bytes = bytes.concat(padding)
  }
  return bytes
}

const bytesFromBigInt = (int, length) => {
  let bytes = toByteArray(int)

  if(length && bytes.length < length) {
    const padding = []
    const needPadding = length - bytes.length
    for(let i = 0; i < needPadding; i++) {
      padding[i] = 0
    }
    bytes = padding.concat(bytes)
  }
  else {
    while(!bytes[0] && (!length || bytes.length > length)) {
      bytes = bytes.slice(1)
    }
  }

  return bytes
}



export { compareBytes, bytesToHex, bytesFromHex, bytesFromArrayBuffer, sha1Bytes, sha1Hash, addPadding, bytesFromBigInt }