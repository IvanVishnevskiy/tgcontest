const Auth = {}

const set = keys => {
  Object.entries(keys).forEach(item => {
    const [ key, value ] = item
    Auth[key] = value
  })
}

export default { set }