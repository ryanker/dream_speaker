'use strict'

let isDebug = false
let isScribble = false
let first = true
let nodeIndex = 0
chrome.storage.local.get(['autoSpeak', 'isScribble'], function (r) {
    isScribble = r.isScribble
    if (r.autoSpeak) setTimeout(speak, 800)
})
chrome.runtime.onMessage.addListener(function (m) {
    debug('m:', m)
    if (m.action === 'speak') {
        speak()
    } else if (m.action === 'speakStart') {
        first = true
        nodeIndex = 0
        speak()
    } else if (m.action === 'scribbleSpeak') {
        let text = getSelection().toString().trim()
        if (text) sendMessage({action: 'scribbleSpeak', text: text})
    }
})

// 划词朗读
document.addEventListener('mouseup', scribbleSpeak)

function scribbleSpeak() {
    if (!isScribble) return
    let text = getSelection().toString().trim()
    if (!text) return
    sendMessage({action: 'scribbleSpeak', text: text})
}

function speak() {
    debug('reading...')
    let tEl = S('h1')

    let cEl
    for (let id of ['cont-text', 'content', 'BookText']) {
        cEl = $(id)
        if (cEl) break
    }
    if (!cEl) return

    // 获取需要朗读的文字
    let title = '', content = ''
    if (tEl) title = tEl.innerText.trim()
    if (cEl) content = cEl.innerText.trim()
    if (!content) return

    // 判断内容是否为小说内容
    if (cEl.getElementsByTagName('img').length > 0) return // 有图片
    if (cEl.innerText.length < 200) return // 内容太少
    let nodes = cEl.childNodes
    if (nodes.length < 3) return
    // let firstNode = cEl.firstChild
    // if (firstNode.nodeName !== '#text') return
    // if (firstNode.nodeValue.trim().length < 1) return
    // if (firstNode.nextSibling.nodeName !== 'BR') return

    // 遍历定位朗读
    let sel = window.getSelection()
    let range = document.createRange()
    if (nodeIndex >= nodes.length) next()
    let isText = false // 是否有文本内容
    while (nodeIndex < nodes.length) {
        let node = nodes[nodeIndex]
        nodeIndex++

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
            sel.removeAllRanges()
            sel.addRange(range)

            // 定位滚动条位置
            let sRange = sel.getRangeAt(0)
            if (sRange) {
                let bcr = sRange.getBoundingClientRect()
                document.scrollingElement.scrollTop = document.scrollingElement.scrollTop + bcr.top - 10
            }

            // 朗读内容
            // let text = sel.toString()
            if (first) {
                text = (title + '\n' + text).trim()
                first = false
            }
            sendMessage({action: 'speak', text: text})
            break
        }
    }
    if (!isText) next() // 如果循环全部节点都没文本，就翻页
}

function next() {
    let aEl = A('a')
    for (let i = 0; i < aEl.length; i++) {
        let el = aEl[i]
        let text = el.innerText.trim()
        if (['下一章', '下一页'].includes(text)) {
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
