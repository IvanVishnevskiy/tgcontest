import bytesFromHex from './bytes'


function bytesFromLeemonBigInt (bigInt) {
  var str = bigInt.toString(16)
  return bytesFromHex(str)
}

function pqPrimeLeemon (what) {
  var minBits = 64
  var minLen = Math.ceil(minBits / bpe) + 1
  var it = 0
  var i, q
  var j, lim
  var g, P
  var Q
  var a = new Array(minLen)
  var b = new Array(minLen)
  var c = new Array(minLen)
  var g = new Array(minLen)
  var z = new Array(minLen)
  var x = new Array(minLen)
  var y = new Array(minLen)

  for (i = 0; i < 3; i++) {
    q = (nextRandomInt(128) & 15) + 17
    copyInt_(x, nextRandomInt(1000000000) + 1)
    copy_(y, x)
    lim = 1 << (i + 18)

    for (j = 1; j < lim; j++) {
      ++it
      copy_(a, x)
      copy_(b, x)
      copyInt_(c, q)

      while (!isZero(b)) {
        if (b[0] & 1) {
          add_(c, a)
          if (greater(c, what)) {
            sub_(c, what)
          }
        }
        add_(a, a)
        if (greater(a, what)) {
          sub_(a, what)
        }
        rightShift_(b, 1)
      }

      copy_(x, c)
      if (greater(x, y)) {
        copy_(z, x)
        sub_(z, y)
      } else {
        copy_(z, y)
        sub_(z, x)
      }
      eGCD_(z, what, g, a, b)
      if (!equalsInt(g, 1)) {
        break
      }
      if ((j & (j - 1)) == 0) {
        copy_(y, x)
      }
    }
    if (greater(g, one)) {
      break
    }
  }

  divide_(what, g, x, y)

  if (greater(g, x)) {
    P = x
    Q = g
  } else {
    P = g
    Q = x
  }

  // console.log(dT(), 'done', bigInt2str(what, 10), bigInt2str(P, 10), bigInt2str(Q, 10))

  return [bytesFromLeemonBigInt(P), bytesFromLeemonBigInt(Q), it]
}

export { pqPrimeLeemon }