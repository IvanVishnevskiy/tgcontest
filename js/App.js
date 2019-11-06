import '../css/App.css'

import { TLSerialization } from './TLHelpers'

import loginJS from '../pages/login/login'
import loginHTML from '../pages/login/login.html'
import loginCSS from '../pages/login/login.css'

import { sendRequest } from './mtproto'
import nextRandomInt from './helpers/nextRandomInt'

import Auth from './Auth'

const $G = query => document.getElementById(query)
const $GS = query => document.querySelector('.' + query)

const showPage = page => {
  document.querySelector('#App').innerHTML = loginHTML
  loginJS()
}

// console.log(loginJS, loginHTML, loginCSS)
showPage()

// const ws = new WebSocket('wss://venus.web.telegram.org:443/apiws_test', ['binary'])

// ws.onopen = () => {
//   console.log(1, 'ws is open')
//   // ws.send(new ArrayBuffer())
// }
// ws.onclose = e => {
//   console.log(1, 'ws closed!', e)
// }
// ws.onerror = e => {
//   console.log(1, 'ws errored', e)
// }
// ws.onmessage = m => {
//   console.log(1, 'message from vs', m)
// }



const buffer = new Uint8Array(40)

const writeBuffer = (shift, lendata, resultbuf, data) => {
  for(i=0; i<lendata; i++){
   var index = data.length - 1 - Math.floor(i/4);
   resultbuf[i+shift] = data[index];
   data[index] = data[index] >>> 8;
 }	
}	

const serializer = new TLSerialization({ mtproto: true });

var nonce = []
for (var i = 0; i < 16; i++) {
  nonce.push(nextRandomInt(0xFF))
}

// serializer.storeString(`req_pq#60469778 nonce:${random128()} = ResPQ`)
serializer.storeMethod('req_pq', { nonce })
// console.log(serializer.createBuffer(`req_pq#60469778 nonce:${random128()} = ResPQ`))

const auth1 = serializer.getArray()

sendRequest(auth1)
.then(([error, data]) => {
  if(error) throw new Error(error)
  window.res = data
  const res = data.fetchObject('ResPQ')
  const { _, server_nonce, pq, server_public_key_fingerprints, fingerprints } = res
  if (_ !== 'resPQ') 
    throw new Error('[MT] resPQ response invalid: ' + response._)
  
  console.log(res)
  if (!bytesCmp(auth.nonce, response.nonce)) 
    throw new Error('[MT] resPQ nonce mismatch')
  
  auth.set({ 
    serverNonce: server_nonce, 
    pq, 
    fingerprints: server_public_key_fingerprints,

  })

  console.log(dT(), 'Got ResPQ', bytesToHex(auth.serverNonce), bytesToHex(auth.pq), auth.fingerprints)

  auth.publicKey = MtpRsaKeysManager.select(auth.fingerprints)

  if (!auth.publicKey) {
    throw new Error('[MT] No public key found')
  }
})
// console.log(auth1)

// const xhr = new XMLHttpRequest
// xhr.open("POST", 'https://venus.web.telegram.org:443/apiws_test', true)
// xhr.setRequestHeader('Content-Type', 'application/octet-stream');
// xhr.send(new Int32Array(auth1))

// xhr.onload = e => {
//   console.log(e)
// }

// fetch('http://149.154.167.40/apiw1', {
//   method: 'POST',
//   // body: new Uint8Array(auth1)
//   body: auth1
// })

// console.log(random128())

// const serialization = new TLSerialization({ mtproto: true })

// serialization.storeString('Privet')

// const deserialization = new TLDeserialization(serialization.getBuffer())

// console.log(deserialization.fetchString())

// console.log(serialization, deserialization)

export { $G, $GS }