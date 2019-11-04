import '../css/App.css'

import loginJS from '../pages/login/login'
import loginHTML from '../pages/login/login.html'
import loginCSS from '../pages/login/login.css'

const $G = query => document.getElementById(query)

const showPage = page => {
  document.querySelector('#App').innerHTML = loginHTML
  loginJS()
}

console.log(loginJS, loginHTML, loginCSS)
showPage()

export { $G }