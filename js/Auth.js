const Auth = {}

const set = keys => {
  Object.entries(keys).forEach(item => {
    const [ key, value ] = item
    Auth[key] = value
  })
}

const get = key => key ? Auth[key] : Auth

export default { set, get }