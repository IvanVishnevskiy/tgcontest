import bigInt from 'big-integer'

console.log('Loading CryptoWorker...')

const factorization = n => {
  let trials = 0
  n = n instanceof bigInt ? n : bigInt(n, 16)
  const two = bigInt(2)
  if(n.mod(two).isZero()) return [two]
  let y = bigInt.randBetween(bigInt(1), n.minus(bigInt(1)))
  const c = bigInt.randBetween(bigInt(1), n.minus(bigInt(1)))
  const m = bigInt.randBetween(bigInt(1), n.minus(bigInt(1)))
  let g = bigInt(1)
  let r = bigInt(1)
  let q = bigInt(1)
  let ys
  let x
  
  while(g.equals(bigInt(1))) {
    x = y
    for(let i = bigInt(0); i.lesser(r); i = i.add(bigInt(1))) {
      trials++
      if(trials > 30000) return factorization(n)
      y = (y.times(y).mod(n.add(c))).mod(n)
    }
    let k = bigInt(0)
    while(k.lesser(r) && g.equals(bigInt(1))) {
      ys = y
      const len = bigInt.min(m, r.minus(k))
      for(let j = bigInt(0); j.lesser(len); j = j.add(bigInt(1))) {
        y = (y.times(y).mod(n).add(c)).mod(n)
        q = q.times(x.minus(y).abs()).mod(n)
      }
      g = bigInt.gcd(q, n)
      k = k.add(m)
    }
    r = r.times(2)
  }
  if (g.equals(n)) {
    while(true) {
      ys = ys.times(ys).mod(n.add(c)).times(n)
      g = bigInt.gcd(x.minus(ys).abs(), n)
      if(!g.lesserOrEquals(bigInt(1))) break
    }
  }
  return [g, n.divide(g)]
}

const tasks = {
  factorization
}

onmessage = (e) => {
  const { data } = e
  const { task, id, params } = data
  if(!id) throw new Error('[CW] No id, exiting.')
  if(!task) throw new Error('[CW] No task, exiting.')
  const taskToCall = tasks[task]
  if(!taskToCall) throw new Error(`[CW] No task to do: ` + task)
  const res = taskToCall(...params)
  postMessage({ id, res })
}