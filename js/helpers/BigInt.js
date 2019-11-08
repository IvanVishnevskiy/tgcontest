import { bytesFromHex } from './bytes'

const DivRem = (x, y) => [x.divide(y), x.mod(y)]

const toByteArray = int => bytesFromHex(int.toString(16))

export { DivRem, toByteArray }