
export default (b1, b2) => {
  const length = b1.length
  if(length !== b2.length) return false

  for(let i = 0; i < length; i++) {
    if(b1[i] !== b2[i]) return false
  }
  return true
}