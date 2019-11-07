import { TLSerialization, TLDeserialization } from './TLHelpers'

import getMessageID from './helpers/getMessageID'


const sendRequest = requestBuffer => {
  const requestLength = requestBuffer.byteLength
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

  return fetch('http://149.154.167.40/apiw1_test', {
    method: 'POST',
    // body: new Uint8Array(auth1)
    body: resultArray
  })
  .then(data => data.arrayBuffer())
  .then(data => {
      const parsedData = new TLDeserialization(data, { mtproto: true })
      parsedData.fetchLong('auth_key_id')
      parsedData.fetchLong('msg_id')
      parsedData.fetchInt('msg_len')
      return [null, parsedData]
    })
  .catch(error => {
    return [error]
  })
}

export { sendRequest }