import Bytes from './Bytes'
import { schema } from './mtproto'
import getMessageID from '../helpers/getMessageID'

import bigInt from 'big-integer'

class Types {
  static int = (data = 0, length = 128) => {
    data = data.map ? data : 
    typeof data === 'string' ? Bytes.fromHex(bigInt(data).toString(16)) : 
    Bytes.fromInt(data, length / 8)
    return data.length === length / 8 ? data : Bytes.addPadding(data.reverse(), length / 8)
  }
}

class Serialization {
  constructor(name, params) {
    if(name && params) this.serialize(name, params)
  }
  bytes = []
  serialize = (inputName = '', inputParams = {}) => {
    if(!inputName) throw new Error('Nothing to serialize')
    const object = schema[inputName.toLowerCase()]
    if(!object) throw new Error('Unknown name: ' + inputName)
    const { id, params, output = '' } = object
    this.bytes = this.bytes.concat(Bytes.fromHex(id).reverse())
    params.forEach(param => {
      const { name, type } = param
      const inputParam = inputParams[name]
      if(!inputParam) console.info(`No param ${name} provided for object ${inputName}`)
      this.bytes = this.bytes.concat(Types[type.fieldType](inputParams[name] || [], type.length))
    })
    return output
  }

  getBytes = () => {
    const { bytes } = this
    const authKey = Types.int(0, 64)
    const id = getMessageID()
    const res = [].concat(
      authKey,
      Types.int(id, 64),
      Types.int(bytes.length, 32).reverse(),
      bytes
    )
    return res
  }

  getBuffer = () => new Uint8Array(this.getBytes()).buffer
}

class Deserialization {
  constructor(name, data) {
    if(name && data) this.deserialize(name, data)
  }
  deserialize = (name = '', data = []) => {
    if(!name) throw new Error('No name')
    data = data.byteLength ? [...new Uint8Array(data)] : data
    if(!data || !data.length) throw new Error('Nothing to deserialize')
    if(data.length % 4) throw new Error('Data length should be divisible by 4')
    const object = schema[name.toLowerCase()]
    if(!object) throw new Error('No object for: ' + name)
    console.log(object, data)
  }
}

// const prepareRequest = (request, authKeyID) => {
//   const requestBytes = request.length ? request : [...new Uint8Array(request)]
//   const requestLength = requestBytes.length

//   const emptyAuthKey = [0, 0, 0, 0, 0, 0, 0, 0]
//   const id = getMessageID()

//   const header = new Serialization()
//   header.store([
//     Serialization.bytes(authKeyID || emptyAuthKey),
//     Serialization.int(id),
//     Serialization.padding(Serialization.int(requestLength).reverse()),
//     Serialization.bytes(requestBytes)
//   ])
// }

export { Serialization, Deserialization }