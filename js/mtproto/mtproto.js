import TLSchema from './schema.js'
import DHSchema from './dhschema'
import SkeletonSchema from './skeletonSchema'

let retrievedSchema
let retrievedNames = {}

const getSchema = () => {
  if(retrievedSchema) return retrievedSchema
  const data = (TLSchema.trim() + '\n' + DHSchema.trim() + '\n' + SkeletonSchema.trim())
  .split('\n')
  .filter(row => 
    row && 
    !row.includes('---functions---')
  )
  .reduce((res, next) => {
    const [ input, output ] = next.trim().split(' = ')
    const hasFlags = input.includes('flags')
    const [ nameAndId, ...params ] = input.replace('Vector ', 'Vector_').split(' ')
    const [ name, id ] = nameAndId.split('#')
    const paramsParsed = params.map(param => {
      param = param.replace(/[{}]/).split(':')
      if(!param.length || param.length === 1) return
      let [ name, type ] = param
      if(type.includes('flags')) {
        const [ , flag, fieldType ] = type.split(/[.?]/)
        type = { flag, fieldType }
      }
      else if (type.includes('int')) {
        type = { fieldType: 'int', length: type.substr(3) }
      }
      else if (type.includes('Vector')) type = { fieldType: 'vector', vectorType: type.split('_')[1]  }
      else type = { fieldType: type }
      return { name, type }
    }).filter(item => item)
    res.schema[name.toLowerCase()] = {
      id,
      params: paramsParsed,
      hasFlags,
      output
    }
    res.names[id] = name.toLowerCase()
    return res
  }, { schema: {}, names: {} })

  const { schema, names } = data
  retrievedSchema = schema
  retrievedNames = names
  return schema
}

getSchema() 

window.schema = retrievedSchema
window.names = retrievedNames

export { retrievedSchema as schema, retrievedNames as names }
