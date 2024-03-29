import '../css/App.css'

import CryptoWorker from './crypto/worker'

// import loginJS from '../pages/login/login'
// import loginHTML from '../pages/login/login.html'

import login from '../pages/login/export'



import { sendRequest } from './mtproto'
import nextRandomInt from './helpers/nextRandomInt'
import { compareBytes, bytesToHex, sha1Bytes, bytesFromHex } from './helpers/bytes'
import { selectKeyByFingerprint } from './RSA'

import Auth from './Auth'
import bigInt from 'big-integer'

import highEntropyRandom from './helpers/highEntropyRandom'

import DH_params from './deserializers/DH_params'

import sendClientDH from './auth/sendClientDH'

import Session from './auth/session'

import { Serialization, Deserialization } from './mtproto/TL'

const { js: loginJS, html: loginHTML } = login

import mtproto from './mtproto/mtproto'
import TL from './mtproto/TL'
import Bytes from './mtproto/Bytes'

window.bigInt = bigInt

const $G = query => document.getElementById(query)
const $GS = query => document.querySelector('.' + query)

const showPage = page => {
  document.querySelector('#App').innerHTML = loginHTML
  loginJS()
}

showPage()

const sendReqPQ = () => {
  let nonce = []
  for (let i = 0; i < 16; i++) {
    nonce.push(nextRandomInt(0xFF))
  }
  Auth.set({ nonce })

  const reqPQ = new Serialization()
  const resName = reqPQ.serialize('req_pq', { nonce })

  sendRequest(reqPQ.getBuffer(), true )
    .then(([error, data]) => {
      if(error) throw new Error(error)
      
      const resPQ = new Deserialization(resName, data)
      window.res = resPQ
      const { name, fields } = resPQ
      if(name !== 'respq') throw new Error('[MT] resPQ response invalid: ' + _)
      const { server_nonce, pq, server_public_key_fingerprints } = fields
      
      if(Bytes.toHex(nonce) !== fields.nonce) throw new Error('[MT] resPQ nonce mismatch')
        
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
      console.log(performance.now(), 'factorization start')
      return CryptoWorker.factorize(pq)
    })
    .then(([p ,q]) => {
      console.log(performance.now(), 'factorization end')
      if(!p || !q) {
        console.error(p, q, Auth.get('pq'))
        throw new Error('[FACTORIZATION] Error factorization. PQ')
      }
      const random = highEntropyRandom(32)

      Auth.set({ new_nonce: random })

      const { nonce, server_nonce, new_nonce, pq, publicKey } = Auth.get()

      const innerData = new Serialization('p_q_inner_data', {
        pq,
        p: p.value.toString(16),
        q: q.value.toString(16),
        nonce,
        server_nonce,
        new_nonce
      })

      // const data = new Serialization()
      // data.store([
      //   Serialization.name('83c95aec'),
      //   Serialization.bytes(pq),
      //   Serialization.bytes(p),
      //   Serialization.bytes(q),
      //   Serialization.bytes(nonce),
      //   Serialization.bytes(server_nonce),
      //   Serialization.bytes(new_nonce),
      // ])

      // const dataWithHash = sha1Bytes(data.getBuffer()).concat(data.getBytes())

      // const req = new Serialization()
      // req.store([
      //   Serialization.name('d712e4be'),
      //   Serialization.bytes(nonce),
      //   Serialization.bytes(server_nonce),
      //   Serialization.bytes(p1),
      //   Serialization.bytes(q1),
      //   Serialization.bigInt(publicKey.fingerprint),
      //   Serialization.byteString(rsaEncrypt(publicKey, dataWithHash))
      // ])

      // return sendRequest(req.getBuffer())
    })
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

