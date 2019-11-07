const Auth = {}

const set = keys => {
  Object.entries(keys).forEach(item => {
    const [ key, value ] = item
    Auth[key] = value
  })
}

const get = key => Auth[key]

export default { set, get }