import { TLSerialization, TLDeserialization } from './TLHelpers'

import getMessageID from './helpers/getMessageID'
import { bytesToHex } from './helpers/bytes'
import bigInt from 'big-integer'
import { Serialization } from './helpers/TL'

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

const prepareRequest = (request, authKeyID) => {
  const requestBytes = request.length ? request : [...new Uint8Array(request)]
  const requestLength = requestBytes.length

  const emptyAuthKey = [0, 0, 0, 0, 0, 0, 0, 0]
  const id = getMessageID()

  const header = new Serialization()
  header.store([
    Serialization.bytes(authKeyID || emptyAuthKey),
    Serialization.int(id),
    Serialization.padding(Serialization.int(requestLength).reverse()),
    Serialization.bytes(requestBytes)
  ])

  console.log(request, requestBytes, header.getBytes() )

  return [ header.getBuffer(), header.getBytes() ]
}

const sendRequest = (requestBuffer, prepared) => {
  
  const resultBuffer = prepared ? requestBuffer : prepareRequest(requestBuffer)[0]
  console.log(prepareRequest(requestBuffer)[0], requestBuffer)
  console.log('[MT] Sending request with length:', resultBuffer.byteLength, resultBuffer)

  return fetch('http://149.154.167.40/apiw1_test', {
    method: 'POST',
    body: resultBuffer
  })
  .then(data => data.arrayBuffer())
  .then(data => {
      const parsedData = new TLDeserialization(data, { mtproto: true })
      parsedData.fetchLong('auth_key_id')
      parsedData.fetchLong('msg_id')
      parsedData.fetchInt('msg_len')
      // return [null, parsedData, parseRawData(data)]
      return [null, data]
    })
  .catch(error => {
    return [error]
  })
}

export { sendRequest, prepareRequest }