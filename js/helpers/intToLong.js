import bigInt from 'big-integer'

export default (high = 0, low = 0) => (bigInt(high).shiftLeft(32).add(bigInt(low))).toString(10)