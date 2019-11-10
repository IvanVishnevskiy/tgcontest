import { bytesFromHex } from './helpers/bytes'

const transformNumber = (bytes, length) => {
  const newBytes = []
  if(length && bytes.length < (length - 3)) {
    while(bytes.length < (length - 3)) bytes.push(0)
  }

  if(!length) newBytes.push(bytes.length)
  
  bytes.forEach(byte => newBytes.push(byte))
  newBytes.push(0)
  newBytes.push(0)
  newBytes.push(0)
  return newBytes
}

const transformString = bytes => {
  let res = []
  const length = bytes.length
  if(length >= 254) {
    res = [254].concat([0, ...bytesFromHex(bytes.length.toString(16))].reverse())
    res.length = 4
  }
  else res.push(bytes.length)
  
  if(res.length < 4) {
    while(res.length < 4) {
      res.push(0)
    }
  }
  return res.concat(bytes)
}

export { transformNumber, transformString}