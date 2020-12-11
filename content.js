'use strict'

let isDebug = false
let conf = {}
let first, nodeIndex, nextHref, nextBody
loadStorage(function () {
    init()
})

chrome.runtime.onMessage.addListener(function (m) {
    debug('m:', m)
    if (m.action === 'speak') {
        speak()
    } else if (m.action === 'speakStart') {
        first = true
        nodeIndex = 0
        speak()
    } else if (m.action === 'loadStorage') {
        loadStorage()
    }
})

// 划词朗读
document.addEventListener('mouseup', function () {
    if (!conf.isScribble) return
    let text = getSelection().toString().trim()
    if (!text) return
    sendMessage({action: 'scribbleSpeak', text: text})
})

// 加载设置
function loadStorage(callback) {
    chrome.storage.local.get(['isScribble', 'autoSpeak', 'enablePreload'], function (r) {
        conf = r
        typeof callback === 'function' && callback()
    })
}

// 初始化参数
function init() {
    first = true
    nodeIndex = 0
    nextHref = ''
    nextBody = null

    // 是否自动开始朗读
    if (conf.autoSpeak) {
        setTimeout(() => {
            speak()
        }, 1000)
    }

    // 预加载下一页
    if (conf.enablePreload) {
        setTimeout(() => {
            nextHref = getNextHref()
            if (nextHref) preloadNext(nextHref)
        }, 1500)
    }
}

// 朗读文本
function speak() {
    debug('reading...')
    let tEl = S('h1')

    let cEl
    for (let id of ['cont-text', 'chaptercontent', 'content', 'BookText']) {
        cEl = $(id)
        if (cEl) break
    }
    if (!cEl) return

    // 获取需要朗读的文字
    let title = '', content = ''
    if (tEl) title = tEl.innerText?.trim()
    if (cEl) content = cEl.innerText?.trim()
    if (!content) return

    // 判断内容是否为小说内容
    if (cEl.getElementsByTagName('img').length > 0) return // 有图片
    if (cEl.getElementsByTagName('h1').length > 0) return // 排除
    if (cEl.innerText.length < 100) return // 内容太少
    let nodes = cEl.childNodes
    if (nodes.length < 1) return
    // let firstNode = cEl.firstChild
    // if (firstNode.nodeName !== '#text') return
    // if (firstNode.nodeValue.trim().length < 1) return
    // if (firstNode.nextSibling.nodeName !== 'BR') return

    // 遍历定位朗读
    let sel = window.getSelection()
    let range = document.createRange()
    if (nodeIndex >= nodes.length) toNext()
    let isText = false // 是否有文本内容
    while (nodeIndex < nodes.length) {
        let node = nodes[nodeIndex]
        nodeIndex++
        if (node.nodeType !== 1 && node.nodeType !== 3) continue

        let text = ''
        if (node.nodeName === '#text') {
            text = node.textContent.trim()
        } else if (node.nodeName === 'P') {
            text = node.innerText.trim()
        } else if (node.nodeName === 'DIV' && node.className === '') {
            text = node.innerText.trim()
        }
        if (text) {
            isText = true

            // 定位选区
            range.selectNode(node)
            // console.log('length:', nodeIndex, text.length)
            sel.removeAllRanges()
            sel.addRange(range)

            // 定位滚动条位置
            let s = sel.toString()?.trim()
            if (s) {
                let sRange = sel.getRangeAt(0)
                if (sRange) {
                    let bcr = sRange.getBoundingClientRect()
                    document.scrollingElement.scrollTop = document.scrollingElement.scrollTop + bcr.top - 10
                }
            }

            // 朗读内容
            if (first) {
                text = (title + '\n' + text).trim()
                first = false
            }
            sendMessage({action: 'speak', text: text})
            break
        }
    }
    if (!isText) toNext() // 如果循环全部节点都没文本，就翻页
}

// 跳转到下一章
function toNext() {
    if (conf.enablePreload && nextBody) {
        let el = S('body')
        if (!el) return
        el.innerHTML = nextBody // 替换页面内容
        document.scrollingElement.scrollTop = 0 // 返回顶部
        history.pushState(null, null, nextHref) // 修改 URL
        setTimeout(() => {
            init() // 初始化
        }, 800)
    } else {
        if (!nextHref) nextHref = getNextHref()
        if (nextHref) location.href = nextHref
    }
}

// 获取下一章
function getNextHref() {
    let aEl = A('a[href]')
    for (let i = 0; i < aEl.length; i++) {
        let el = aEl[i]
        let text = el.innerText.trim()
        if (el.id === 'next' || ['下一章', '下一页'].includes(text)) {
            let url = el.getAttribute('href')
            if (url.length > 11 && url.substring(0, 11) === 'javascript:') return ''
            // if (url.length < 4) return ''
            // if (url[0] === '/' || url.substring(0, 4) === 'http') return url
            return url
        }
    }
}

// 预加载下一章
function preloadNext(nextHref) {
    // let link = document.createElement("link")
    // link.href = nextHref
    // link.rel = 'preload'
    // link.as = 'fetch'
    // document.head.appendChild(link)
    httpGet(nextHref, 'document').then(r => {
        let el = r.querySelector('body')
        if (el) nextBody = el.innerHTML
        // console.log(nextHref, r.querySelector('h1').innerText, nextBody.length)
        // setTimeout(toNext, 5000)
    }).catch(err => {
        debug(err)
    })
}

function httpGet(url, type, headers) {
    return new Promise((resolve, reject) => {
        let c = new XMLHttpRequest()
        c.responseType = type || 'text'
        c.timeout = 30000
        c.onload = function (e) {
            if (this.status === 200) {
                resolve(this.response)
            } else {
                reject(e)
            }
        }
        c.ontimeout = function (e) {
            reject('NETWORK_TIMEOUT', e)
        }
        c.onerror = function (e) {
            reject('NETWORK_ERROR', e)
        }
        c.open("GET", url)
        headers && headers.forEach(v => {
            c.setRequestHeader(v.name, v.value)
        })
        c.send()
    })
}

function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, function (response) {
            let err = chrome.runtime.lastError
            if (err) {
                reject(err)
            } else {
                resolve(response)
            }
        })
    })
}

function $(id) {
    return document.getElementById(id)
}

function S(selector) {
    return document.querySelector(selector)
}

function A(selector) {
    return document.querySelectorAll(selector)
}

function debug(...data) {
    isDebug && console.log('[DEBUG]', ...data)
}
