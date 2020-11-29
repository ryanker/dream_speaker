'use strict'

let isDebug = false
chrome.storage.local.get('autoSpeak', function (r) {
    if (r.autoSpeak === 'on') speak()
})
chrome.runtime.onMessage.addListener(function (m) {
    debug('m:', m)
    if (m.action === 'speak') {
        speak()
    } else if (m.action === 'next') {
        next()
    }
})

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

function speak() {
    debug('reading...')
    let tEl = S('h1')
    let cEl = $('content')
    let title = '', content = ''
    if (tEl) title = tEl.innerText.trim()
    if (cEl) content = cEl.innerText.trim()
    let text = (title + '\n' + content).trim()
    let message = {action: 'speak', text: text}
    debug('message:', message)
    content && sendMessage(message)
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
