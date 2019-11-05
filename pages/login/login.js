import countries from './Components/countries.json'

import { $GS } from '../../js/App' 

const showCountriesList = () => {
  $GS('l_clh').classList.remove('l_clh_h')
}
const hideCountriesList = () => {
  $GS('l_clh').classList.add('l_clh_h')
}

const manageButtons = () => {
  const countryInput = $GS('login_country_input')
  const phoneInput = $GS('login_phone_input')
  countryInput.onfocus = showCountriesList
  countryInput.addEventListener('focusout', e => {
    e.target.classList.add('keepFloating')
    // this timeout is used to prevent label fickering
    setTimeout(() => {
      hideCountriesList()
      e.target.classList.remove('keepFloating')
    }, 200)
  })
  phoneInput.onfocus = hideCountriesList
}

const manageCountries = () => {
  const createElem = (html, className, tag) => {
    const elem = document.createElement(tag || 'div')
    elem.innerHTML = html
    elem.className = className
    return elem
  }
  const list = $GS('l_cl');
  const fragment = document.createDocumentFragment()
  countries.forEach(item => {
    const { name, code } = item
    const elem = createElem('', 'l_cli', 'li')
    const nameElem = createElem(name, 'l_clin')
    const codeElem = createElem(code, 'l_clic')
    elem.append(nameElem, codeElem)
    elem.onclick = () => {
      $GS('login_country_input').value = name
    }
    fragment.appendChild(elem)
  })
  list.appendChild(fragment)
}

const init = () => {
  manageCountries()
  manageButtons()
}

export default init