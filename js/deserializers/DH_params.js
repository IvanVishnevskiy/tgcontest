import { bytesToHex, sha1Bytes } from '../helpers/bytes'
import Auth from '../Auth'

import { bytesToArrayBuffer } from '../helpers/bytes'

import AES from '../crypto/AES'
import { TLDeserialization } from '../TLHelpers'

import compareBytes from '../helpers/compareBytes'

import bigInt from 'big-integer'

const verifyDHParams = (g, dhPrime, gA) => {
  const dhPrimeHex = bytesToHex(dhPrime)
  if(
    g !== 3 ||
    dhPrimeHex !==  'c71caeb9c6b1c9048e6c522f70f13f73980d40238e3e21c14934d037563d930f48198a0aa7c14058229493d22530f4dbfa336f6e0ac925139543aed44cce7c3720fd51f69458705ac68cd4fe6b6b13abdc9746512969328454f18faf8c595f642477fe96bb2a941d5bcd1d4ac8cc49880708fa9b378e3c4f3a9060bee67cf9a4a4a695811051907e162753b56b0f6b410dba74d8a84b2a14b3144e0ef1284754fd17ed950d5965b4b9dd46582db1178d169c6bc465b0d6ff9ca3928fef5b9ae4e418fc15e83ebea0f87fa9ff5eed70050ded2849f47bf959d956850ce929851f0d8115f635b105ee2e4e15d04b2454bf6f4fadf034b10403119cd8e3b92fcc5b'
  ) throw new Error('[MT] DH params are not verified: unknown dhPrime')

  const bigGA = bigInt(bytesToHex(gA), 16)
  const bigDHPrime = bigInt(dhPrimeHex, 16)
  
  if(bigGA.compareTo(bigInt(1)) <= 0) 
    throw new Error('[MT] DH params are not verified: gA <= 1')
  

  if(bigGA.compareTo(bigDHPrime.subtract(bigInt(1))) >= 0) 
    throw new Error('[MT] DH params are not verified: gA >= dhPrime - 1')
  

  const two = new bigInt(2)
  const twoPow = two.pow(2048 - 64)

  if(bigGA.compareTo(twoPow) < 0) 
    throw new Error('[MT] DH params are not verified: gA < 2^{2048-64}')
  
  if(bigGA.compareTo(bigDHPrime.subtract(twoPow)) >= 0) 
    throw new Error('[MT] DH params are not verified: gA > dhPrime - 2^{2048-64}')

  return true
}

const parseInnerData = (innerData, hash) => {
  const buffer = bytesToArrayBuffer(innerData)
  var deserializer = new TLDeserialization(buffer, {mtproto: true})
  var response = deserializer.fetchObject('Server_DH_inner_data')

  if (response._ != 'server_DH_inner_data') {
    throw new Error('[MT] server_DH_inner_data response invalid: ' + constructor)
  }

  const { g, dh_prime, g_a, server_time, nonce, server_nonce } = response

  if (!compareBytes(Auth.get('nonce'), nonce)) {
    throw new Error('[MT] server_DH_inner_data nonce mismatch')
  }

  if (!compareBytes(Auth.get('server_nonce'), server_nonce)) {
    throw new Error('[MT] server_DH_inner_data serverNonce mismatch')
  }
    Auth.set({
      g,
      dh_prime,
      g_a,
      server_time,
      retry: 0
    })

    verifyDHParams(g, dh_prime, g_a)

    const offset = deserializer.getOffset()

    if (!compareBytes(hash, sha1Bytes(innerData.slice(0, offset)))) {
      throw new Error('[MT] server_DH_inner_data SHA1-hash mismatch')
    }
    return response
    // MtpTimeManager.applyServerTime(auth.serverTime, auth.localTime)
}

const deserializer = data => {
  console.log(performance.now(), 'DH Params deserializer start')
  const encrypted_answer = data.slice(40, 632)
  const server_nonce1 = data.slice(20, 36)
  const nonce1 = data.slice(4, 20)

  const { new_nonce, server_nonce } = Auth.get()

  const aes = sha1Bytes(
    new_nonce
    .concat(server_nonce)
    .concat(sha1Bytes(
      server_nonce
      .concat(new_nonce)
    ))
    .slice(0, 12)
  )

  const aesIv = sha1Bytes(
    server_nonce
    .concat(new_nonce)
    .slice(12)
    .concat(
      sha1Bytes(
        [].concat(new_nonce, new_nonce)
      ),
      new_nonce.slice(0, 4)
    )
  )
  const auth = { newNonce: new_nonce, serverNonce: server_nonce }

  const tmpAesKey = sha1Bytes(auth.newNonce.concat(auth.serverNonce)).concat(sha1Bytes(auth.serverNonce.concat(auth.newNonce)).slice(0, 12))
  const tmpAesIv = sha1Bytes(auth.serverNonce.concat(auth.newNonce)).slice(12).concat(sha1Bytes([].concat(auth.newNonce, auth.newNonce)), auth.newNonce.slice(0, 4))

  Auth.set({ tmpAesIv, tmpAesKey })

  const answerWithHash = AES.decrypt(encrypted_answer, tmpAesKey, tmpAesIv)
  const hash = answerWithHash.slice(0, 20)
  const answerWithPadding = answerWithHash.slice(20)
  // answerWithPadding.length = 564
  const innerData = parseInnerData(answerWithPadding, hash)
  console.log(performance.now(), 'DH Params deserializer end')
  return innerData
}

export default deserializer