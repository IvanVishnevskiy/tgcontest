import { bytesFromHex } from './bytes'
import bigInt from 'big-integer'

import seedrandom from 'seedrandom'
import { get } from 'http'

const bytes = []

let rng

const nowToBytes = now => Math.floor(seedrandom(now)() * 255)

const listener = () => {
  if(bytes.length >= 32 * 4) return
  rng = seedrandom(performance.now(), { entropy: true })
  for(let i = 0; i < 32; i++) bytes.push(Math.floor(rng() * 255))
}

const getNextByte = () => {
  // We assume that client has enough completed actions to make true random number so will we fill array with some pseudo-random values if we don't have any left action-seeded ones.
  const byte = bytes[0] || nowToBytes(performance.now() + Math.random() * 10000)
  bytes.shift()
  return byte
}

window.addEventListener('click', listener)
window.addEventListener('keypress', listener)

const highEntropyRandom = (length = 32) => [...new Array(length)].map(item => getNextByte())

window.getNextByte = getNextByte
window.highEntropyRandom = highEntropyRandom

export default highEntropyRandom