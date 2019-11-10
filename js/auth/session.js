import highEntropyRandom from '../helpers/highEntropyRandom'

class Session {
  initedConnection = false
  sessionID = highEntropyRandom(8)
  authKey = {}
  authDone = false

  initSession = () => {

  }

  connect = () => {
    
  }
}

export default Session