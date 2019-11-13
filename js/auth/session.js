import highEntropyRandom from '../helpers/highEntropyRandom'
import AES from '../crypto/AES'
import { bytesToHex, sha256Hash, bytesFromHex, compareBytes } from '../helpers/bytes'
import Config from '../Config'
import { TLSerialization, TLDeserialization } from '../TLHelpers'
import { addPadding } from '../helpers/bytes'
import { prepareRequest } from '../mtproto'

import getMessageID from '../helpers/getMessageID'

import aesjs from 'aes-js'

import SHA256 from 'crypto-js/sha256'
import { Serialization } from '../helpers/TL'

const blobToBuffer = blob => new Promise(resolve => {
  const fileReader = new FileReader()
  fileReader.onload = event => resolve(event.target.result)
  fileReader.readAsArrayBuffer(blob)
})

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
      console.log('[WS] open')
      this.signalWSConnected()
      // ws.send(new Uint8Array(bytes).buffer)
      this.initWS()
      setTimeout(() => {
        this.sendGetNearestDC()
      }, 1000)
    }
    ws.onclose = e => {
      console.log('[WS] closed', e)
    }
    ws.onerror = e => {
      this.signalWSConnected()
      console.error('[WS] error', e)
    }
    ws.onmessage = m => {
      console.log('[WS] got message', m)
      blobToBuffer(m.data)
      .then(this.parseWSMessage)
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
    dataWithPadding = dataWithPadding.byteLength ? [...new Uint8Array(dataWithPadding)] : dataWithPadding
    const { authKey } = this
    const x = isOut ? 0 : 8
    const msgKeyLargePlain = authKey.slice(88 + x, 88 + x + 32).concat(dataWithPadding)

    const hash = sha256Hash(msgKeyLargePlain)

    return Promise.resolve(hash.slice(8, 24))
  }

  getAesKeyIv = (msgKey, isOut) => {
    const { authKey } = this
    const x = isOut ? 0 : 8
    const sha2aText = new Uint8Array(52)
    const sha2bText = new Uint8Array(52)
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
    const dc = [0xfe, 0xff] 

    while(!payload) {
      const bytes = highEntropyRandom(56).concat(protocol).concat(dc).concat(highEntropyRandom(2))
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
    const messageReversed = [...payload].reverse()
    const encryptKey = payload.slice(8, 40)
    const encryptIV = payload.slice(40, 56)
    const decryptKey = messageReversed.slice(8, 40)
    const decryptIV = messageReversed.slice(40, 56)
    
    this.enc = new aesjs.ModeOfOperation.ctr(encryptKey, new aesjs.Counter(encryptIV))
    this.dec = new aesjs.ModeOfOperation.ctr(decryptKey, new aesjs.Counter(decryptIV))

    const encryptedPayload = [...new Uint8Array(this.enc.encrypt(payload))]
    const finalPayload = payload.slice(0, 56).concat(encryptedPayload.slice(56, 64))
    this.ws.send(new Uint8Array(finalPayload).buffer)
  }

  prepareWSMessage = data => {
    const length = data.length
    const hexLength = Number(length).toString(16)
    const bytesLength = addPadding(bytesFromHex(hexLength), 4)
    return bytesLength.concat(data)
  }

  preparePayload = payload => {
    const [,buffer] = prepareRequest(payload, this.authKeyID)
    return [...new Uint8Array(buffer)]
  }

  send = message => {
    message = message.byteLength ? [...new Uint8Array(message)] : message
    const finalMessage = [...new Uint8Array(this.enc.encrypt(this.prepareWSMessage(message)))] 
    this.ws.send(new Uint8Array(finalMessage).buffer)
  }

  initSessionWrapper = options => {
    const { name, int, string, padding, bytes } = Serialization
    const data = new Serialization()

    console.log(navigator.platform)

    data.store([
      name('da9b0d0d'), // invokeWithLayer
      padding(int(105)), // layer
      name('785188b8'), // initConnection
      bytes([0, 0, 0, 0]),
      padding(int(Config.api_id)),
      string(navigator.userAgent || 'Unknown UserAgent'),
      string(navigator.platform || 'Unknown Platform'),
      string(Config.App.version),
      string('en'),
      string(''),
      string('en'),
    ])

    const serializer = new TLSerialization(options)
    serializer.storeInt(0xda9b0d0d, 'invokeWithLayer')
    serializer.storeInt(105, 'layer')
    serializer.storeInt(0x785188b8, 'initConnection')
    serializer.storeRawBytes([0, 0, 0, 0], 'flags')
    serializer.storeInt(Config.api_id, 'api_id')
    serializer.storeString(navigator.userAgent || 'Unknown UserAgent', 'device_model')
    serializer.storeString(navigator.platform || 'Unknown Platform', 'system_version')
    serializer.storeString(Config.App.version, 'app_version')
    serializer.storeString('en', 'system_lang_code')
    serializer.storeString('', 'lang_pack')
    serializer.storeString('en', 'lang_code')
    console.log(data.getBytes(), serializer.getBytes())
    return serializer

  }

  connect = () => {
    
  }

  sendGetNearestDC = () => {
    const { name, bytes, int, string, hex } = Serialization
    const wrapped = this.initSessionWrapper().getBytes()
    const data = new Serialization()
    data.store([
      bytes(wrapped),
      name('1fb33026'),
    ])

    console.log(bytesToHex(wrapped))

    const seq_no = this.getSeqNo() + 1
    const msg_id = getMessageID()
    const dcID = this.dcID
    console.log(seq_no, msg_id, dcID)
    const message = {
      msg_id,
      seq_no,
      body: data.getBytes(),
      isAPI: true,
      dcID
    }
    return this.sendRequest(message)
  }

  wrapAPI = (method, params = {}, options = {}) => this.waitForOpen.then(() => {
    const serializer = this.connectionInited ? new TLSerialization(options) : this.initSessionWrapper(options)

    if (options.afterMessageID) {
      serializer.storeInt(0xcb9f372d, 'invokeAfterMsg')
      serializer.storeLong(options.afterMessageID, 'msg_id')
    }

    console.log(method, params, options)
    options.resultType = serializer.storeMethod(method, params)
    const messageID = getMessageID()
    const seqNo = this.getSeqNo(true) + 1

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
    dataWithPadding = dataWithPadding.byteLength ? dataWithPadding : new Uint8Array(dataWithPadding).buffer
    let msgK
    return this.getMsgKey(dataWithPadding, true)
    .then(msgKey => { msgK = msgKey; return this.getAesKeyIv(msgKey, true) })
    .then(keyIv => {
      return AES.encrypt(dataWithPadding, keyIv[0], keyIv[1])
    })
    .then(encrypted => ({ bytes: encrypted, msgKey: msgK }))
  }

  sendRequest = message => {
    const { bytes, paddingBytes, paddingInt, hex } = Serialization
    const options = {}
    const { serverSalt, authKeyID, sessionID } = this

    const d = new Serialization()
    d.store([
      paddingBytes(serverSalt, 8),
      paddingBytes(sessionID, 8),
      Serialization.padding(hex(message.msg_id)),
      paddingInt(message.seq_no),
      paddingInt(message.body.length),
      bytes(message.body)
    ])
    const data = new TLSerialization({ startMaxLength: message.body.length + 2048 })
    data.storeIntBytes(serverSalt, 64, 'salt')
    data.storeIntBytes(sessionID, 64, 'session_id')
    data.storeLong(message.msg_id, 'message_id')
    data.storeInt(message.seq_no, 'seq_no')

    data.storeInt(message.body.length, 'message_data_length')
    data.storeRawBytes(message.body, 'message_data')

    console.log(
      '__________________',
      serverSalt, sessionID, message.msg_id, message.seq_no, message.body.length, bigInt(message.msg_id).toString(16)
    )
    console.log(d.getBytes(), data.getBytes())
    const paddingLength = 4
    console.log(paddingLength)
    const padding = highEntropyRandom(paddingLength)


    const dataWithPadding = data.getBytes().concat(padding)
    console.log(dataWithPadding, dataWithPadding.length, dataWithPadding.length % 4)
    return this.encryptRequest(dataWithPadding).then(encryptedResult => {
      const { bytes, int, padding } = Serialization
      const req = new Serialization()
      req.store([
        bytes(authKeyID),
        bytes(encryptedResult.msgKey),
        padding(int(encryptedResult.bytes.length).reverse()),
        bytes(encryptedResult.bytes)
      ])

      console.log(')))))))))))))', authKeyID, encryptedResult.msgKey, encryptedResult.bytes.length)

      const request = new TLSerialization({startMaxLength: encryptedResult.bytes.byteLength + 256})
      request.storeIntBytes(authKeyID, 64, 'auth_key_id')
      request.storeIntBytes(encryptedResult.msgKey, 128, 'msg_key')
      request.storeInt(encryptedResult.bytes.length, 'encrypted_data_length')
      request.storeRawBytes(encryptedResult.bytes, 'encrypted_data')
      
      this.send(request.getBuffer())
    })
  }

  parseWSMessage = buffer => {
    const decrypted = this.dec.decrypt(new Uint8Array(buffer))
    console.log(decrypted)
    var deserializer = new TLDeserialization(buffer)
      console.log(buffer)
      var authKeyID = deserializer.fetchIntBytes(64, false, 'auth_key_id')
      if (!compareBytes(authKeyID, this.authKeyID)) {
        console.log(authKeyID, this.authKeyID)
        throw new Error('[MT] Invalid server auth_key_id: ')
      }
      var msgKey = deserializer.fetchIntBytes(128, true, 'msg_key')
      var encryptedData = deserializer.fetchRawBytes(buffer.byteLength - deserializer.getOffset(), true, 'encrypted_data')
      console.log(encryptedData)
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