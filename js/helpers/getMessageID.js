import nextRandomInt from './nextRandomInt'
import intToLong from './intToLong'

let lastMessageID = [0, 0]

const now = seconds => {
  const date = Number(new Date())
  return seconds ? Math.floor(date / 1000 ) : date
}

let timeOffset = 0

const getID = () => {
  const ticks = now()
  const timeSec = Math.floor(ticks / 1000) + timeOffset
  const timeMsec = ticks % 1000
  const random = nextRandomInt(0xFFFF)

  let newid = [timeSec, (timeMsec << 21) | (random << 3) | 4]
  const lastid = lastMessageID

  if(lastid[0] > newid[0] || lastid[0] === newid[0] && lastid[1] >= newid[1]) 
    newid = [lastid[0], lastid[1] + 4]
  

  lastMessageID = newid
  return intToLong(newid[0], newid[1]) 
}

export default getID