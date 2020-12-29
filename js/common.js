'use strict'

const isDebug = false
const isFirefox = inArray("Firefox", navigator.userAgent)
const B = {
    getBackgroundPage: chrome.extension.getBackgroundPage,
    id: chrome.runtime.id,
    onMessage: chrome.runtime.onMessage,
    sendMessage: chrome.runtime.sendMessage,
    error: chrome.runtime.lastError,
    storage: chrome.storage,
    browserAction: chrome.browserAction,
    contextMenus: chrome.contextMenus,
    notifications: chrome.notifications,
    tabs: chrome.tabs,
    tts: chrome.tts,
}

function storageLocalGet(options) {
    return storage('local', 'get', options)
}

function storageLocalSet(options) {
    return storage('local', 'set', options)
}

function storage(type, method, options) {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            let callback = function (r) {
                let err = B.error
                err ? reject(err) : resolve(r)
            }
            let api = type === 'sync' ? B.storage.sync : B.storage.local
            if (method === 'get') {
                api.get(options, callback)
            } else if (method === 'set') {
                api.set(options, callback)
            }
        } else {
            let api = isDebug ? browser.storage.local : type === 'sync' ? browser.storage.sync : browser.storage.local
            if (method === 'get') {
                api.get(options).then(r => resolve(r), err => reject(err))
            } else if (method === 'set') {
                api.set(options).then(r => resolve(r), err => reject(err))
            }
        }
    })
}

function sendMessage(message) {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            B.sendMessage(message, r => B.error ? reject(B.error) : resolve(r))
        } else {
            browser.runtime.sendMessage(message).then(r => resolve(r), err => reject(err))
        }
    })
}

function sendTabMessage(tabId, message) {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            // B.tabs.sendMessage(tabId, message, r => B.error ? reject(B.error) : resolve(r))
            tabId && B.tabs.sendMessage(tabId, message)
        } else {
            // browser.tabs.sendMessage(tabId, message).then(r => resolve(r)).catch(err => reject(err))
            tabId && browser.tabs.sendMessage(tabId, message).catch(err => debug('send error:', err))
        }
        resolve()
    })
}

function getActiveTabId() {
    return new Promise((resolve, reject) => {
        if (!isFirefox) {
            B.tabs.query({currentWindow: true, active: true}, tab => {
                let tabId = tab[0] && tab[0].url && resolve(tab[0].id)
                resolve(tabId)
            })
        } else {
            browser.tabs.query({currentWindow: true, active: true}).then(tab => {
                let tabId = tab[0] && resolve(tab[0].id)
                resolve(tabId)
            }, err => reject(err))
        }
    })
}

// 获得所有语音的列表 (firefox 不支持)
function getVoices() {
    return new Promise((resolve, reject) => {
        if (!B.tts || !B.tts.getVoices) return reject("I won't support it!")

        B.tts.getVoices(function (voices) {
            let list = {}
            for (let i = 0; i < voices.length; i++) {
                let v = voices[i]
                // debug('Voice:', i, JSON.stringify(v))
                let {lang, voiceName, remote} = v
                if (!list[lang]) list[lang] = []
                list[lang].push({lang, voiceName, remote})
            }
            resolve(list)
        })
    })
}

function inArray(val, arr) {
    return arr.indexOf(val) !== -1
    // return arr.includes(val)
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

function httpPost(options) {
    let o = Object.assign({
        url: '',
        responseType: 'json',
        type: 'form',
        body: null,
        timeout: 30000,
        headers: [],
    }, options)
    return new Promise((resolve, reject) => {
        let c = new XMLHttpRequest()
        c.responseType = o.responseType
        c.timeout = o.timeout
        c.onload = function (e) {
            if (this.status === 200 && this.response !== null) {
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
        c.open("POST", o.url)
        if (o.type === 'form') {
            c.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
        } else if (o.type === 'json') {
            c.setRequestHeader("Content-Type", "application/json; charset=UTF-8")
        } else if (o.type === 'xml') {
            c.setRequestHeader("Content-Type", "application/ssml+xml")
        }
        o.headers.length > 0 && o.headers.forEach(v => {
            c.setRequestHeader(v.name, v.value)
        })
        c.send(o.body)
    })
}

function debug(...data) {
    isDebug && console.log('[DEBUG]', ...data)
}
