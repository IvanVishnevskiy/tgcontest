import '../css/App.css'

import CryptoWorker from './crypto/worker'

import loginJS from '../pages/login/login'
import loginHTML from '../pages/login/login.html'
import loginCSS from '../pages/login/login.css'

import { sendRequest } from './mtproto'
import nextRandomInt from './helpers/nextRandomInt'
import { compareBytes, bytesToHex, sha1Bytes, bytesFromHex, addPadding } from './helpers/bytes'
import { selectKeyByFingerprint, rsaEncrypt } from './RSA'

import Auth from './Auth'
import bigInt from 'big-integer'

import highEntropyRandom from './helpers/highEntropyRandom'

import DH_params from './deserializers/DH_params'

import { transformString, transformNumber } from './typeTransformations'

import sendClientDH from './auth/sendClientDH'
import { randomBytes } from 'crypto'

import AES from './crypto/AES'

window.bigInt = bigInt

const $G = query => document.getElementById(query)
const $GS = query => document.querySelector('.' + query)

const showPage = page => {
  document.querySelector('#App').innerHTML = loginHTML
  loginJS()
}

showPage()

const buffer = new Uint8Array(40)

const writeBuffer = (shift, lendata, resultbuf, data) => {
  for(i=0; i<lendata; i++){
   var index = data.length - 1 - Math.floor(i/4);
   resultbuf[i+shift] = data[index];
   data[index] = data[index] >>> 8;
 }	
}	

const sendReqPQ = () => {
  const nonce = []
  for (let i = 0; i < 16; i++) {
    nonce.push(nextRandomInt(0xFF))
  }
  Auth.set({ nonce })


  const reqPQ = bytesFromHex('60469778').reverse()
  .concat(nonce) 


  sendRequest(new Uint8Array(reqPQ).buffer)
    .then(([error, data]) => {
      if(error) throw new Error(error)
      const res = data.fetchObject('ResPQ')
      window.res = res
      const { _, server_nonce, pq, server_public_key_fingerprints, fingerprints } = res
      if (_ !== 'resPQ') 
        throw new Error('[MT] resPQ response invalid: ' + _)
      
      if (!compareBytes(nonce, res.nonce)) 
        throw new Error('[MT] resPQ nonce mismatch')
      Auth.set({ 
        server_nonce: server_nonce, 
        pq, 
        fingerprints: server_public_key_fingerprints,

      })

      Auth.set({
        publicKey: selectKeyByFingerprint(server_public_key_fingerprints)
      })

      if (!Auth.get('publicKey')) {
        throw new Error('[MT] No public key found')
      }
      else console.log('Got MT public key')

      const hexPQ = bytesToHex(pq)

      console.log(performance.now(), 'factorization start')
      return CryptoWorker.factorize(hexPQ)
    })
    .then(([p ,q]) => {
      console.log(performance.now(), 'factorization end')
      if(!p || !q) {
        console.error(p, q, Auth.get('pq'))
        throw new Error('[FACTORIZATION] Error factorization. PQ')
      }
      const random = highEntropyRandom(32)
      p = bytesFromHex(p.value.toString(16))
      q = bytesFromHex(q.value.toString(16))


      Auth.set({ new_nonce: random })

      const { nonce, server_nonce, new_nonce, pq, publicKey } = Auth.get()

      const pq1 = transformNumber(pq)
      const q1 = transformNumber(q)
      const p1 = transformNumber(p)

      const data1 = bytesFromHex('83c95aec').reverse()
      .concat(pq1)
      .concat(p1)
      .concat(q1)
      .concat(nonce)
      .concat(server_nonce)
      .concat(new_nonce)

      const dataWithHash = sha1Bytes(new Uint8Array(data1).buffer).concat(data1)

      const req = bytesFromHex('d712e4be').reverse()
      .concat(nonce)
      .concat(server_nonce)
      .concat(p1)
      .concat(q1)
      .concat(bytesFromHex(bigInt(publicKey.fingerprint).toString(16)).reverse())
      .concat(transformString(rsaEncrypt(publicKey, dataWithHash)))

      return sendRequest(new Uint8Array(req).buffer)
    })
    .then(([error, data, rawData]) => {
      if(error) throw new Error('Can\'t get DH!')
      return Promise.resolve(DH_params(rawData.data))
    })
    .then(dhData => {
      return sendClientDH(dhData)
    })
    .then(done => {
      console.log(performance.now(), '[MT] Got server salt')
      localStorage.setItem('auth', JSON.stringify(Auth.get()))
    })
}

sendReqPQ()

const ws = new WebSocket('wss://venus.web.telegram.org:443/apiws_test', ['binary'])

ws.onopen = () => {
  console.log(1000, 'ws is open')
  // ws.send(new Uint8Array(bytes).buffer)
  initWS()
}
ws.onclose = e => {
  console.log(1001, 'ws closed!', e)
}
ws.onerror = e => {
  console.log(1002, 'ws errored', e)
}
ws.onmessage = m => {
  console.log(1003, 'message from vs', m)
}

const initWS = () => {
  console.log(performance.now(), 'Init WS start')
  let payload 

  // Abridged protocol
  const protocol = [0xfe, 0xfe, 0xfe, 0xfe]

  while(!payload) {
    const bytes = [...randomBytes(60)].concat(protocol)
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

  const finalPayload = obfuscateWSMessage(payload)
  

  // ws.send(new Uint8Array(finalPayload).buffer)
}

const obfuscateWSMessage = message => {
  const messageReversed = message.reverse()

  const encryptKey = message.slice(8, 40)
  const encryptIV = message.slice(40, 56)

  const decryptKey = messageReversed.slice(8, 40)
  const decryptIV = messageReversed.slice(40, 56)

  const encryptedMessage = AES.encryptWS(encryptKey, encryptIV, message)
  const finalMessage = message.slice(0, 56).concat(encryptedMessage.slice(56, 64))

  return finalMessage
}

const prepareWSMessage = data => {
  const protocol = 0xef
  const length = data.length >> 2

  if(length < 127) return [length].concat(data)
  else return [protocol]
  .concat(addPadding(bytesFromHex(Number(data.length).toString(16)), 3))
  .concat(data)
}

const writeWS = data => {
  const message = prepareWSMessage(data)
  console.log(message)
}

// initRev := strrev(init)

// encryptKey := substr(init, 8, 32)
// encryptIV := substr(init, 40, 16)

// decryptKey := substr(initRev, 8, 32)
// decryptIV := substr(initRev, 40, 16)

// secret := substr(0xdd99999999999999999999999999999999, 1, 16)

// encryptKey = SHA256(encryptKey + secret)
// decryptKey = SHA256(decryptKey + secret)

// encryptedInit := CTR(encryptKey, encryptIV, init)

// finalInit := substr(init, 0, 56) + substr(encryptedInit, 56, 8)

// write(finalInit)

export { $G, $GS }

