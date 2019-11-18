class Bytes {
  bytes = []
  constructor(bytes) {
    if(!bytes.length || !bytes.byteLength) throw new Error('Invalid bytes')
    if(bytes.byteLength) bytes = [...new Uint8Array(bytes)]
    this.bytes = bytes
  }

  static fromInt = (int = 0, length = 4) => {
    for(var res = [], i = 0; i < length; i++) res.push(int >> (i * 8) & 0xff)
    return res.reverse()
  }
  static addPadding = (data = [], length = 8) => {
    while(data.length < length) data.push(0x00)
    return data
  }
  static fromHex = hex => {
    const length = hex.length
    let start = 0
    const bytes = []
    if(length % 2) {
      bytes.push(parseInt(hex.charAt(0), 16))
      start++
    }
    for(let i = start; i < length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16))
    return bytes
  }
}

export default Bytes