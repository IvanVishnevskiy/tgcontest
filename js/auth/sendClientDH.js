import Auth from '../Auth'

import CryptoWorker from '../crypto/worker'
import { bytesFromHex, sha1Bytes, bytesXor } from '../helpers/bytes'
import compareBytes from '../helpers/compareBytes'

import highEntropyRandom from '../helpers/highEntropyRandom'

import { transformNumber, transformString } from '../typeTransformations'
import AES from '../crypto/AES'
import { sendRequest } from '../mtproto'

const sendClientDH = params => new Promise((resolve, reject) => {
  const { dh_prime } = params 
  const gBytes = bytesFromHex(params.g.toString(16))
  const b = highEntropyRandom(256)
  Auth.set({ b })
  const { nonce, server_nonce, new_nonce } = Auth.get()
  CryptoWorker.modPow(gBytes, b, dh_prime).then(
    gB => {
      gB = gB.value.toString(16)
      gB = gB.length % 2 === 0 ? gB : '0' + gB
      Auth.set({ retry: Auth.get('retry') })
      const { tmpAesIv, tmpAesKey, retry } = Auth.get()
      const data = bytesFromHex('6643b654').reverse()
      .concat(nonce)
      .concat(server_nonce)
      .concat(transformNumber(bytesFromHex(retry.toString(16)), 8).reverse())
      .concat(transformString(bytesFromHex(gB)))

      const dataWithHash = sha1Bytes(new Uint8Array(data).buffer).concat(data)
      const encryptedData = AES.encrypt(dataWithHash, tmpAesKey, tmpAesIv)

      const req = bytesFromHex('f5045f1f').reverse()
      .concat(nonce)
      .concat(server_nonce)
      .concat(transformString(encryptedData))

      return sendRequest(new Uint8Array(req).buffer)
    }
  )
  .then(([error, data]) => {
    if(error) throw new Error('[MT] DH params set error', error)
    const response = data.fetchObject('Set_client_DH_params_answer')

    if (response._ != 'dh_gen_ok' && response._ != 'dh_gen_retry' && response._ != 'dh_gen_fail') 
      throw new Error('[MT] Set_client_DH_params_answer response invalid: ' + response._)
    

    if (!compareBytes(nonce, response.nonce)) 
      throw new Error('[MT] Set_client_DH_params_answer nonce mismatch')

    if (!compareBytes(server_nonce, response.server_nonce)) 
        throw new Error('[MT] Set_client_DH_params_answer server_nonce mismatch')

    const { g_a, b } = Auth.get()

    return CryptoWorker.modPow(g_a, b, dh_prime)
    .then(
      authKey => Promise.resolve([bytesFromHex(authKey.value.toString(16)), response])
    )
  })
  .then(([authKey, response]) => {
    const authKeyHash = sha1Bytes(authKey)
    const authKeyAux = authKeyHash.slice(0, 8)
    const authKeyID = authKeyHash.slice(-8)
    console.log(authKeyHash, authKeyAux, authKeyID)
    const { _ } = response

    switch(_) {
      case 'dh_gen_ok': {
        const newNonceHash1 = sha1Bytes(new_nonce.concat([1], authKeyAux)).slice(4)

        if(!compareBytes(newNonceHash1, response.new_nonce_hash1))
          throw new Error('[MT] Set_client_DH_params_answer new_nonce_hash1 mismatch')

        const serverSalt = bytesXor(new_nonce.slice(0, 8), server_nonce.slice(0, 8))
        Auth.set({
          authKeyID,
          authKey,
          serverSalt
        })
        resolve()
        break
      }

      case 'dh_gen_retry': {
        const newNonceHash2 = sha1Bytes(new_nonce.concat([2], authKeyAux)).slice(-16)
        if(!compareBytes(newNonceHash2, response.new_nonce_hash2))
          throw new Error('[MT] Set_client_DH_params_answer new_nonce_hash2 mismatch')
        
          sendClientDH(params)
          break
      }

      case 'dh_gen_fail': {
        const newNonceHash3 = sha1Bytes(new_nonce.concat([3], authKeyAux)).slice(-16)
        if(!compareBytes(newNonceHash3, response.new_nonce_hash3))
          throw new Error('[MT] Set_client_DH_params_answer new_nonce_hash2 mismatch')
        break
      }
    }
  })
  .catch(
    e => reject(e)
  )
})

export default sendClientDH
