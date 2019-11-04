const elements = []
window.elements = elements
let previousRenderedNode = ''

const updateElement = (id, item) => {
  console.log(id, item)
  // const elem = elements[id]
  // console.log(elem)
  // const prevNodes = [...elem.element.childNodes].sort((a, b) => a.id.localeCompare(b.id))
  // const newNodes = [...item.childNodes].sort((a, b) => a.id.localeCompare(b.id))
  // console.log(prevNodes.map(node => node.innerHTML), newNodes.map(node => node.innerHTML))
  // console.log(prevNodes.map(node => node.textContent), newNodes.map(node => node.textContent))

  // let biggerOrEqualList
  // let lesserList

  // if(prevNodes.length >= newNodes.length) {
  //   biggerOrEqualList = prevNodes
  //   lesserList = newNodes
  // }
  // else {
  //   biggerOrEqualList = newNodes
  //   lesserList = prevNodes
  // }

  // biggerOrEqualList.filter(node => {
  //   const textContent = node.textContent
  //   const equalTextNodeIndex = lesserList.findIndex(node => node && node.textContent === textContent)
  //   if(equalTextNodeIndex !== -1) {
  //     delete lesserList[equalTextNodeIndex]
  //     return false
  //   }
  //   return true
  // })
  // lesserList = lesserList
  // // biggerOrEqualList = biggerOrEqualList

  // console.log(biggerOrEqualList, lesserList)


  // // for(let i = 0; i < prevNodes.length >= newNodes.length ? prevNodes.length : newNodes.length; i++) {
  // //   const 
  // // }

  // console.log(prevNodes, newNodes)
  document.querySelector(`#${id}`).innerHTML = item.innerHTML
}

class Component {
  constructor(props = {}, children = []) {
    if(props.id) this._id = props.id
    this.children = children
  }
  static isClass = true
  state = {}
  setState = (obj) => {
    Object.entries(obj).forEach(entry => {
      const [ key, value ] = entry
      this.state[key] = value
      updateElement(this._id, this.render())
    })
  }
}

const renderToHTML = (query, item) => {
  document.querySelector(query).appendChild(new item().render())
}

const writeToTree = (id, element, parent, children = []) => {
  console.log(1, id)
  const item = {
    id,
    element,
    parent
  }
  elements.push(item)
  children.forEach(child => {
    const { id } = child
    console.log(2, id)
    const item = {
      id,
      element: child,
      parent: element
    }
    elements.push(item)
  })
  return element
}

const dom = (tag, attrs, ...children) => {
  const parentNode = elements.findIndex(elem => elem.id === previousRenderedNode.id)
  attrs = attrs || {}
  const id = `El${String(Math.random()).replace('.', '')}`
  previousRenderedNode = id
  
  // Custom Components will be functions
  if (typeof tag === 'function') {
    if(tag.isClass) {
      const classTag = new tag({ id, children })
      const renderedTag = classTag.render()
      renderedTag.id = id
      return writeToTree(id, renderedTag, parentNode)
    }
    return writeToTree(id, tag(), parentNode)
  }
  // regular html tags will be strings to create the elements
  if (typeof tag === 'string') {
    
    // fragments to append multiple children to the initial node
    const fragments = document.createDocumentFragment()
    const element = document.createElement(tag)
    if(attrs.onClick) element.onclick = attrs.onClick
    children = children.map(child => {
      const id = `Node${String(Math.random()).replace('.', '')}`
      if (child instanceof HTMLElement) {
        child.id = id
        fragments.appendChild(child)
        return child
      } else if (typeof child === 'string' || typeof child === 'number'){
        const textNode = document.createTextNode(child)
        textNode.id = id
        fragments.appendChild(textNode)
        return textNode
      } else {
        // later other things could not be HTMLElement not strings
        console.log('not appendable', child);
      }
    })
    element.appendChild(fragments)
    // Merge element with attributes
    Object.assign(element, attrs)
    return writeToTree(id, element, parentNode, children)
  }
}

export { dom, Component, renderToHTML }