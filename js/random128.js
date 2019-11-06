export default () => {
  let res = []
  for(let i = 0; i < 8; i++) res.push(Math.random() * 0x10000)
  return res
}