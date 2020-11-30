'use strict'

let isDebug = false
let first = true
let nodeIndex = 0
chrome.storage.local.get('autoSpeak', function (r) {
    if (r.autoSpeak === 'on') speak()
})
chrome.runtime.onMessage.addListener(function (m) {
    debug('m:', m)
    if (m.action === 'speak') {
        speak()
    } else if (m.action === 'speakStart') {
        first = true
        nodeIndex = 0
        speak()
    }
})

function speak() {
    debug('reading...')
    let tEl = S('h1')
    let cEl = $('content')
    if (!cEl) return

    // 获取需要朗读的文字
    let title = '', content = ''
    if (tEl) title = tEl.innerText.trim()
    if (cEl) content = cEl.innerText.trim()
    if (!content) return

    // 判断内容是否为小说内容
    let nodes = cEl.childNodes
    if (nodes.length < 10) return
    let firstNode = cEl.firstChild
    if (firstNode.nodeName !== '#text') return
    if (firstNode.nodeValue.trim().length < 1) return
    if (firstNode.nextSibling.nodeName !== 'BR') return

    // 遍历定位朗读
    let sel = window.getSelection()
    let range = document.createRange()
    if (nodeIndex >= nodes.length) next()
    while (nodeIndex < nodes.length) {
        let node = nodes[nodeIndex]
        nodeIndex++
        let text = node.textContent.trim()
        if (text) {
            // 定位选区
            range.selectNode(node)
            sel.removeAllRanges()
            sel.addRange(range)

            // 定位滚动条位置
            let bcr = sel.getRangeAt(0).getBoundingClientRect()
            document.scrollingElement.scrollTop = document.scrollingElement.scrollTop + bcr.top - 10

            // 朗读内容
            let content = sel.toString()
            if (first) {
                content = (title + '\n' + content).trim()
                first = false
            }
            sendMessage({action: 'speak', text: content})
            break
        }
    }
}

function next() {
    let aEl = A('a')
    for (let i = 0; i < aEl.length; i++) {
        let el = aEl[i]
        let text = el.innerText.trim()
        if (text === '下一章') {
            location.href = el.getAttribute('href')
            break
        }
    }
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
