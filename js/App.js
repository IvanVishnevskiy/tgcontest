import '../css/App.css'

import CryptoWorker from './crypto/worker'

// import loginJS from '../pages/login/login'
// import loginHTML from '../pages/login/login.html'

import login from '../pages/login/export'



import { sendRequest } from './mtproto'
import nextRandomInt from './helpers/nextRandomInt'
import { compareBytes, bytesToHex, sha1Bytes, bytesFromHex } from './helpers/bytes'
import { selectKeyByFingerprint, rsaEncrypt } from './RSA'

import Auth from './Auth'
import bigInt from 'big-integer'

import highEntropyRandom from './helpers/highEntropyRandom'

import DH_params from './deserializers/DH_params'

import { transformString, transformNumber } from './typeTransformations'

import sendClientDH from './auth/sendClientDH'

import Session from './auth/session'

import { Serialization, Deserialization } from './mtproto/TL'

const { js: loginJS, html: loginHTML } = login

import mtproto from './mtproto/mtproto'
import TL from './mtproto/TL'

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

  const reqPQ = new Serialization()
  const resName = reqPQ.serialize('req_pq', { nonce })

  sendRequest(reqPQ.getBuffer(), true )
    .then(([error, data]) => {
      if(error) throw new Error(error)
      window.res = data
      const resPQ = new Deserialization(resName, data)
      return
      const { _, server_nonce, pq, server_public_key_fingerprints } = res
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
    // .then(([p ,q]) => {
    //   console.log(performance.now(), 'factorization end')
    //   if(!p || !q) {
    //     console.error(p, q, Auth.get('pq'))
    //     throw new Error('[FACTORIZATION] Error factorization. PQ')
    //   }
    //   const random = highEntropyRandom(32)
    //   p = bytesFromHex(p.value.toString(16))
    //   q = bytesFromHex(q.value.toString(16))


    //   Auth.set({ new_nonce: random })

    //   const { nonce, server_nonce, new_nonce, pq, publicKey } = Auth.get()
    //   const pq1 = transformNumber(pq)
    //   const q1 = transformNumber(q)
    //   const p1 = transformNumber(p)

    //   const data = new Serialization()
    //   data.store([
    //     Serialization.name('83c95aec'),
    //     Serialization.bytes(pq1),
    //     Serialization.bytes(p1),
    //     Serialization.bytes(q1),
    //     Serialization.bytes(nonce),
    //     Serialization.bytes(server_nonce),
    //     Serialization.bytes(new_nonce),
    //   ])

    //   const dataWithHash = sha1Bytes(data.getBuffer()).concat(data.getBytes())

    //   const req = new Serialization()
    //   req.store([
    //     Serialization.name('d712e4be'),
    //     Serialization.bytes(nonce),
    //     Serialization.bytes(server_nonce),
    //     Serialization.bytes(p1),
    //     Serialization.bytes(q1),
    //     Serialization.bigInt(publicKey.fingerprint),
    //     Serialization.byteString(rsaEncrypt(publicKey, dataWithHash))
    //   ])

    //   return sendRequest(req.getBuffer())
    // })
    // .then(([error, data, rawData]) => {

    //   if(error) throw new Error('Can\'t get DH!')
    //   return Promise.resolve(DH_params(rawData.data))
    // })
    // .then(dhData => {

    //   return sendClientDH(dhData)
    // })
    // .then(done => {

    //   console.log(performance.now(), '[MT] Got server salt')
    //   const { serverSalt, authKey, authKeyID } = Auth.get()
    //   const wsSession = new Session({ serverSalt, authKey, authKeyID, dcID: 2 })
    //   setTimeout(() => {
    //     // wsSession.wrapAPI('auth.sendCode', {
    //     //   flags: 0,
    //     //   phone_number: 79998303931,
    //     //   api_id: Config.api_id,
    //     //   api_hash: Config.api_hash,
    //     //   lang_code: navigator.language || 'en'
    //     // })
    //     // wsSession.wrapAPI('help.getNearestDc')
    //     // wsSession.wrapAPI('help.getNearestDc')
    //   }, 1000)
    //   localStorage.setItem('auth', JSON.stringify(Auth.get()))
    // })
}

sendReqPQ()

export { $G, $GS }

