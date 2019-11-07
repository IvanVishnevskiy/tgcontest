const CryptoWorker = new Worker('/CryptoWorker.js')


const callCryptoWorker = (task, ...params) => new Promise(resolve => {
  const id = Math.random()
  CryptoWorker.postMessage({ id, task, params })
  CryptoWorker.onmessage = ({ data }) => {
    const { id: id1, res } = data
    if(id1 === id) resolve(res)
  }
})

const factorize = number => callCryptoWorker('factorization', number)

export default { factorize }