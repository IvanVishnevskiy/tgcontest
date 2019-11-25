import Bytes from './Bytes'
import { schema, names } from './mtproto'
import getMessageID from '../helpers/getMessageID'

import bigInt from 'big-integer'

class TypesIn {
  static int = (data = 0, length = 128) => {
    data = data.map ? data : 
    typeof data === 'string' ? Bytes.fromHex(bigInt(data).toString(16)) : 
    Bytes.fromInt(data, length / 8)
    return data.length === length / 8 ? data : Bytes.addPadding(data.reverse(), length / 8)
  }
}

class TypesOut {
  static int = (data = [], type) => {
    let { length = 128 } = type
    length = length / 8
    let item = new Array(length)
    for(let i = 0; i < length; i++) item[i] = data[i]
    const hexItem = Bytes.toHex(item)
    item = (length >= 8 && parseInt(hexItem, 16) !== 0) ? hexItem : Bytes.toInt(item) 
    return { item, res: data.slice(length) }
  }
  static bytes = (data = []) => ({ res: [], item: data })
  static string = (data = []) => {
    if(data.length === 0) return []
    let offset = 0
    let start = 0
    let length = data[0]
    if(length > 254) {
      length = Bytes.toInt(data.slice(0, 4))
      offset += 4
      start = 4
    }
    else {
      offset++
      start++
    }
    offset += length
    while(offset % 4) offset++
    const str = Bytes.toHex(data.slice(start, length + start).reverse())
    return { item: str, res: data.slice(offset)}
  }
  static vector = (data = [], type) => {
    if(!data || !data.length) return console.error('No data to parse long from.')
    const { vectorType } = type
    if(!type) return console.error('No type for vector.')
    const name = Bytes.toHex(data.slice(0, 4))
    const count = Bytes.toInt(data.slice(4, 8).reverse())
    const items = []
    data = data.slice(8)
    for(let i = 0; i < count; i++) {
      const { item, res } = TypesOut[vectorType](data)
      data = res
      items.push(item)
    }
    return { item: items, res: data }
  }
  static long = data => {
    if(!data || !data.length) return console.error('No data to parse long from.')
    const item = Bytes.toHex(data.slice(0, 8))
    return { item, res: data.slice(8)}
  }
  static name = data => {
    if(!data || !data.length) return console.error('No data to parse long from.')
    return { item: Bytes.toHex(data.slice(0, 4)), res: data.slice(4) }
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
      this.bytes = this.bytes.concat(TypesIn[type.fieldType](inputParams[name] || [], type.length))
    })
    return output
  }

  getBytes = () => {
    const { bytes } = this
    const authKey = TypesIn.int(0, 64)
    const id = getMessageID()
    const res = [].concat(
      authKey,
      TypesIn.int(id, 64),
      TypesIn.int(bytes.length, 32).reverse(),
      bytes
    )
    return res
  }
  getRawBytes = () => this.bytes
  getBuffer = () => new Uint8Array(this.getBytes()).buffer
}

class Deserialization {
  constructor(name, data) {
    if(name && data) this.deserialize(name, data)
  }
  
  fields = {}
  deserialize = (name = '', data = [], rec) => {
    if(!name) throw new Error('No name')
    data = data.byteLength ? [...new Uint8Array(data)] : data
    if(!data || !data.length) throw new Error('Nothing to deserialize')
    if(data.length % 4) throw new Error('Data length should be divisible by 4')
    const object = schema[name.toLowerCase()]
    if(!object) throw new Error('No object for: ' + name)
    const skeleton = schema.notloggedskeleton
    if(!rec && !skeleton) throw new Error('No skeleton found');
    (rec ? object.params : skeleton.params).forEach(field => {
      const { name, type } = field
      const { res, item } = TypesOut[type.fieldType](data || [], type)
      data = res
      this.fields[name] = item
    })
    this.name = names[this.fields.name]
    if(!rec) this.deserialize(name, this.fields.message_data, true)
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