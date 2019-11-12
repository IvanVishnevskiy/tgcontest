import { TLSerialization, TLDeserialization } from './TLHelpers'

import getMessageID from './helpers/getMessageID'
import { bytesToHex } from './helpers/bytes'
import bigInt from 'big-integer'

const parseRawData = data => {
  const view = new Uint8Array(data)
  const length = view.byteLength
  const res = new Array(length)
  for(let i = 0; i < length; i++) {
    res[i] = view[i]
  }
  const auth_key_id = res.splice(0, 8) // we don't need auth_key_id
  const message_id = bigInt(bytesToHex(res.splice(0, 8)), 16).toString(10)
  const message_length = Number('0x' + bytesToHex(res.splice(0, 4).reverse()))
  return { message_id, message_length, data: res }
}

const prepareRequest = request => {
  const requestBuffer = request.bytesLength ? request : new Uint8Array(request).buffer
  if(!requestBuffer.byteLength) {
    const resultBuffer = new ArrayBuffer(requestBuffer.length)
    const resultArray = new Int32Array(resultBuffer)
    resultArray.set(resultBuffer)
    requestBuffer = resultArray.buffer
  }
  const requestLength = requestBuffer.byteLength || requestBuffer.length
  const requestArray = new Int32Array(requestBuffer)

  const header = new TLSerialization()

  header.storeLongP(0, 0, 'auth_key_id')
  header.storeLong(getMessageID(), 'msg_id')
  header.storeInt(requestLength, 'request_length')
  const headerBuffer = header.getBuffer()
  const headerArray = new Int32Array(headerBuffer)
  const headerLength = headerBuffer.byteLength

  const resultBuffer = new ArrayBuffer(headerLength + requestLength)
  const resultArray = new Int32Array(resultBuffer)

  resultArray.set(headerArray)
  resultArray.set(requestArray, headerArray.length)
  return [ resultArray, resultBuffer ]
}

const sendRequest = (requestBuffer, prepared) => {
  
  const [ resultArray, resultBuffer ] = prepareRequest(requestBuffer)

  console.log('[MT] Sending request with length:', resultBuffer.byteLength, resultBuffer)

  return fetch('http://149.154.167.40/apiw1_test', {
    method: 'POST',
    body: prepared ? requestBuffer : resultArray
  })
  .then(data => data.arrayBuffer())
  .then(data => {
      const parsedData = new TLDeserialization(data, { mtproto: true })
      parsedData.fetchLong('auth_key_id')
      parsedData.fetchLong('msg_id')
      parsedData.fetchInt('msg_len')
      return [null, parsedData, parseRawData(data)]
    })
  .catch(error => {
    return [error]
  })
}

export { sendRequest, prepareRequest }