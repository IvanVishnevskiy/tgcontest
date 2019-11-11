import highEntropyRandom from '../helpers/highEntropyRandom'
import AES from '../crypto/AES'
import { randomBytes } from 'crypto'
import { bytesToHex, sha256Hash, bytesFromHex } from '../helpers/bytes'
import Config from '../Config'
import { TLSerialization } from '../TLHelpers'
import { addPadding } from '../helpers/bytes'
import nextRandomInt from '../helpers/nextRandomInt'
import { prepareRequest } from '../mtproto'

import getMessageID from '../helpers/getMessageID'

import SHA256 from 'crypto-js/sha256'

function bufferConcat (buffer1, buffer2) {
  var l1 = buffer1.byteLength || buffer1.length
  var l2 = buffer2.byteLength || buffer2.length
  var tmp = new Uint8Array(l1 + l2)
  tmp.set(buffer1 instanceof ArrayBuffer ? new Uint8Array(buffer1) : buffer1, 0)
  tmp.set(buffer2 instanceof ArrayBuffer ? new Uint8Array(buffer2) : buffer2, l1)

  return tmp.buffer
}

console.log('___', bufferConcat([0, 1], [2, 3]))

class Session {
  constructor(params) {
    const { serverSalt, dcID, authKey, authKeyID } = params
    this.serverSalt = serverSalt
    this.dcID = dcID
    this.authKey = authKey
    this.authKeyID = authKeyID

    // console.log(JSON.stringify({ authKey }))

    const ws = new WebSocket('wss://venus.web.telegram.org:443/apiws_test', ['binary'])
    this.ws = ws
    ws.onopen = () => {
      console.log(1000, 'ws is open')
      this.signalWSConnected()
      // ws.send(new Uint8Array(bytes).buffer)
      this.initWS()
    }
    ws.onclose = e => {
      console.log(1001, 'ws closed!', e)
    }
    ws.onerror = e => {
      this.signalWSConnected()
      console.log(1002, 'ws errored', e)
    }
    ws.onmessage = m => {
      console.log(1003, 'message from vs', m)
    }
  }

  waitForOpen = new Promise(resolve => this.signalWSConnected = resolve)
  initedConnection = false
  sessionID = highEntropyRandom(8)
  authKey = {}
  authDone = false
  seqNo = 0
  encryptIV = ''
  encryptKey = ''

  getSeqNo = contentRelated => {
    let seqNo = this.seqNo * 2
    if (contentRelated) {
      seqNo++
      this.seqNo++
    }

    return seqNo
  }

  getMsgKey = (dataWithPadding, isOut) => {
    const { authKey } = this
    const authKeyUint = new Uint8Array(authKey) 
    const x = isOut ? 0 : 8
    const msgKeyLargePlain = bufferConcat(authKeyUint.subarray(88 + x, 88 + x + 32), dataWithPadding)
    
    // console.log('____________', authKeyUint, msgKeyLargePlain, dataWithPadding)

    const hash = sha256Hash(msgKeyLargePlain)
    
    // const transfer2 = JSON.stringify({ plain: [...new Uint8Array(msgKeyLargePlain)], hash })
    // console.log(transfer2)

    return Promise.resolve(hash.slice(8, 24))
    // return CryptoWorker.sha256Hash(msgKeyLargePlain).then(function (msgKeyLarge) {
    //   var msgKey = new Uint8Array(msgKeyLarge).subarray(8, 24)
    //   return msgKey
    // })
  }

  getAesKeyIv = (msgKey, isOut) => {
    const { authKey } = this
    const x = isOut ? 0 : 8
    const sha2aText = new Uint8Array(52)
    const sha2bText = new Uint8Array(52)
    const promises = {}

    sha2aText.set(msgKey, 0)
    sha2aText.set(new Uint8Array(authKey).subarray(x, x + 36), 16)
    const sha2a = sha256Hash(sha2aText)

    sha2bText.set(new Uint8Array(authKey).subarray(40 + x, 40 + x + 36), 0)
    sha2bText.set(msgKey, 36)
    const sha2b = SHA256(sha2bText)
    const aesKey = new Uint8Array(32)
    const aesIv = new Uint8Array(32)
    const sha2aU = new Uint8Array(sha2a)
    const sha2bU = new Uint8Array(sha2b)

    aesKey.set(sha2aU.subarray(0, 8))
    aesKey.set(sha2bU.subarray(8, 24), 8)
    aesKey.set(sha2aU.subarray(24, 32), 24)

    aesIv.set(sha2bU.subarray(0, 8))
    aesIv.set(sha2aU.subarray(8, 24), 8)
    aesIv.set(sha2bU.subarray(24, 32), 24)

    return Promise.resolve([aesKey, aesIv])
  }

  initWS = () => {
    let payload 

    // Intermidiate protocol
    const protocol = [0xee, 0xee, 0xee, 0xee]
    const dc = [2, 0] 

    while(!payload) {
      const bytes = highEntropyRandom(56).concat(protocol).concat(dc).concat(highEntropyRandom(2)).reverse()
      if(bytes[0] === 0xef) continue
      
      // first int
      const f = bytesToHex(bytes.slice(0, 4))
      if(
        f === '44414548' || 
        f === '54534f50' || 
        f === '20544547' ||
        f === '4954504f' ||
        f === 'dddddddd' ||
        f === 'eeeeeeee'
      ) continue

      // second int
      const s = bytesToHex(bytes.slice(4, 8))
      if(s === '00000000') continue

      payload = bytes
    }

    const finalPayload = this.obfuscateWSMessage(payload, true)
    const finalMessage = payload.slice(0, 56).concat(finalPayload.slice(56, 64))
    // this.ws.send(new Uint8Array([0xee, 0xee, 0xee, 0xee]).buffer)
    this.ws.send(new Uint8Array(finalMessage))
    
    this.startPQ()

  }

  preparePlainMessage = requestBuffer => {
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
    return resultArray.buffer
  }

  startPQ = () => {
    const nonce = []
    for (let i = 0; i < 16; i++) {
      nonce.push(nextRandomInt(0xFF))
    }


    const reqPQ = bytesFromHex('60469778').reverse()
    .concat(nonce)



    const [ , buffer ] = prepareRequest(new Uint8Array(reqPQ).buffer)
    console.log(buffer)
    this.send(buffer)
  }

  obfuscateWSMessage = (message, init) => {
    const messageReversed = [...message].reverse()

    const encryptKey = init ? message.slice(8, 40) : this.encryptKey
    const encryptIV = init ? message.slice(40, 56) : this.encryptIV

    const decryptKey = init ? messageReversed.slice(8, 40) : this.decryptKey
    const decryptIV = init ? messageReversed.slice(40, 56) : this.decryptIV

    if(init) {
      this.encryptKey = encryptKey
      this.encryptIV = encryptIV
      this.decryptKey = decryptKey
      this.decryptIV = decryptIV
    }
    console.log(0, message)
    const encryptedMessage = AES.encrypt(message, encryptKey, encryptIV)
    console.log(1, encryptedMessage)
    console.log(2, encryptKey, decryptKey, encryptIV, decryptIV)
    const decryptedMessage = AES.decrypt(message, decryptKey, decryptIV)
    console.log(3, decryptedMessage)
    return encryptedMessage
  }

  prepareWSMessage = data => {
    const length = data.length
    const hexLength = Number(length).toString(16)
    const bytesLength = addPadding(bytesFromHex(hexLength), 4)
    return bytesLength.concat(data)
  }

  send = message => {
    message = [...new Uint8Array(message)]
    console.log(message)
    // console.log(155555, this.obfuscateWSMessage(message), this.prepareWSMessage(message), message)
    const finalMessage = this.prepareWSMessage(this.obfuscateWSMessage(message))
    console.log(213545, this.prepareWSMessage(message), finalMessage)
    this.ws.send(new Uint8Array(finalMessage).buffer)
  }

  initSessionWrapper = options => {
    const serializer = new TLSerialization(options)
    serializer.storeInt(0xda9b0d0d, 'invokeWithLayer')
    serializer.storeInt(Config.Schema.API.layer, 'layer')
    serializer.storeInt(0xc7481da6, 'initConnection')
    serializer.storeInt(Config.api_id, 'api_id')
    serializer.storeString(navigator.userAgent || 'Unknown UserAgent', 'device_model')
    serializer.storeString(navigator.platform || 'Unknown Platform', 'system_version')
    serializer.storeString(Config.App.version, 'app_version')
    serializer.storeString(navigator.language || 'en', 'system_lang_code')
    serializer.storeString('', 'lang_pack')
    serializer.storeString(navigator.language || 'en', 'lang_code')
    return serializer
  }

  connect = () => {
    
  }

  wrapAPI = (method, params, options = {}) => this.waitForOpen.then(() => {
    const serializer = this.connectionInited ? new TLSerialization(options) : this.initSessionWrapper(options)

    if (options.afterMessageID) {
      serializer.storeInt(0xcb9f372d, 'invokeAfterMsg')
      serializer.storeLong(options.afterMessageID, 'msg_id')
    }

    console.log(method, params, options)
    options.resultType = serializer.storeMethod(method, params)
    const messageID = getMessageID()
    const seqNo = this.getSeqNo(true)

    const message = {
      msg_id: messageID,
      seq_no: seqNo,
      body: serializer.getBytes(true),
      isAPI: true,
      dcID: this.dcID
    }
    return this.sendRequest(message)
  })
  
  encryptRequest = dataWithPadding => {
    let msgK
    return this.getMsgKey(dataWithPadding, true)
    .then(msgKey => { msgK = msgKey; return this.getAesKeyIv(msgKey, true) })
    .then(keyIv => {
      // const transfer = JSON.stringify({ keyIv: keyIv.map(item => ([...item])), msgK: [...msgK], dataWithPadding: [...new Uint8Array(dataWithPadding)] })
      // console.log(keyIv, msgK)
      // console.log(transfer)
      return AES.encrypt(dataWithPadding, keyIv[0], keyIv[1])
    })
    .then(encrypted => ({ bytes: encrypted, msgKey: msgK}))
  }

  sendRequest = message => {
    const options = {}

    const data = new TLSerialization({ startMaxLength: message.body.length + 2048 })
    const { serverSalt, authKeyID } = this
    // return console.log(123, serverSalt)
    console.log(1, message)
    data.storeIntBytes(serverSalt, 64, 'salt')
    data.storeIntBytes(this.sessionID, 64, 'session_id')

    data.storeLong(message.msg_id, 'message_id')
    data.storeInt(message.seq_no, 'seq_no')

    data.storeInt(message.body.length, 'message_data_length')
    data.storeRawBytes(message.body, 'message_data')
    const dataBuffer = data.getBuffer()

    // const paddingLength = ((1 + Math.floor(Math.random() * 5))
    var paddingLength = (16 - (data.offset % 16)) + 16 * (1 + Math.floor(Math.random() * 5))
    const padding = highEntropyRandom(paddingLength)
    console.log(padding)
    const dataWithPadding = bufferConcat(dataBuffer, padding)

    return this.encryptRequest(dataWithPadding).then(encryptedResult => {
      // console.log(dT(), 'Got encrypted out message'/*, encryptedResult*/)
      // console.log(encryptedResult)
      const request = new TLSerialization({startMaxLength: encryptedResult.bytes.byteLength + 256})
      request.storeIntBytes(authKeyID, 64, 'auth_key_id')
      request.storeIntBytes(encryptedResult.msgKey, 128, 'msg_key')
      request.storeRawBytes(encryptedResult.bytes, 'encrypted_data')
      console.log(request.getBytes())
      this.send(request.getBytes())
      // var requestPromise
      // var url = MtpDcConfigurator.chooseServer(self.dcID, self.upload)
      // var baseError = {code: 406, type: 'NETWORK_BAD_RESPONSE', url: url}

      // try {
      //   options = angular.extend(options || {}, {
      //     responseType: 'arraybuffer',
      //     transformRequest: null
      //   })
      //   requestPromise = $http.post(url, requestData, options)
      // } catch (e) {
      //   requestPromise = $q.reject(e)
      // }
      // return requestPromise.then(
      //   function (result) {
      //     if (!result.data || !result.data.byteLength) {
      //       return $q.reject(baseError)
      //     }
      //     return result
      //   },
      //   function (error) {
      //     if (!error.message && !error.type) {
      //       error = angular.extend(baseError, {type: 'NETWORK_BAD_REQUEST', originalError: error})
      //     }
      //     return $q.reject(error)
      //   }
      // )
    })
  }
}



export default Session

// MtpApiManager.invokeApi('auth.sendCode', {
//   flags: 0,
//   phone_number: $scope.credentials.phone_full,
//   api_id: Config.App.id,
//   api_hash: Config.App.hash,
//   lang_code: navigator.language || 'en'
// }

// if (!this.connectionInited) {
//   serializer.storeInt(0xda9b0d0d, 'invokeWithLayer')
//   serializer.storeInt(Config.Schema.API.layer, 'layer')
//   serializer.storeInt(0xc7481da6, 'initConnection')
//   serializer.storeInt(Config.App.id, 'api_id')
//   serializer.storeString(navigator.userAgent || 'Unknown UserAgent', 'device_model')
//   serializer.storeString(navigator.platform || 'Unknown Platform', 'system_version')
//   serializer.storeString(Config.App.version, 'app_version')
//   serializer.storeString(navigator.language || 'en', 'system_lang_code')
//   serializer.storeString('', 'lang_pack')
//   serializer.storeString(navigator.language || 'en', 'lang_code')
// }