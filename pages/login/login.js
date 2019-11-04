import { $G } from '../../js/App' 

const manageButtons = () => {
  $G('login_signup').onclick = () => console.log('qwe')
}

const init = () => {
  manageButtons()
  console.log('inited')
}

export default init