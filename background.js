'use strict'

var isDebug = true
var conf = {}, langList = {}, voiceList = {}
document.addEventListener('DOMContentLoaded', function () {
    // 读取配置
    loadConf()

    // 语言列表
    fetch('language.json').then(r => r.json()).then(list => {
        langList = list
        chrome.storage.local.set({'langList': list}, function () {
            // debug('langList:', list)
        })
    })
})

// 语音列表
chrome.tts.getVoices(function (voices) {
    for (let i = 0; i < voices.length; i++) {
        // debug('Voice ' + i + ':', JSON.stringify(voices[i]))
        let v = voices[i]
        if (!voiceList[v.lang]) voiceList[v.lang] = []
        voiceList[v.lang].push({lang: v.lang, voiceName: v.voiceName, remote: v.remote})
    }
})

// 监听消息
chrome.runtime.onMessage.addListener(function (m, sender, sendResponse) {
    // debug('sender', sender)
    debug(sender.tab ? `from: ${sender.tab.url}` : `from extensions`)
    debug('request', m)
    sendResponse('received')
    if (!sender.tab) return
    let tabId = sender.tab.id
    if (m.action === 'speak') {
        speak(m.text).then(() => {
            sendMessage(tabId, {action: 'next'})
        }).catch(err => {

        })
    }
})

// 向当前窗口发送消息
function currentTabMessage(message) {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        // alert(JSON.stringify(tabs))
        tabs[0] && tabs[0].url && sendMessage(tabs[0].id, message)
    })
}

// 发送消息
function sendMessage(tabId, message) {
    chrome.tabs.sendMessage(tabId, message)
}

function loadConf() {
    let s = localStorage.getItem('conf')
    if (s) conf = JSON.parse(s)
    debug(conf)
}

function setConf(k, v) {
    conf[k] = v
    localStorage.setItem('conf', JSON.stringify(conf))
}

function resetConf() {
    localStorage.removeItem('conf')
    conf = {}
}

function debug(...data) {
    isDebug && console.log('[DEBUG]', ...data)
}

function speak(text) {
    return new Promise((resolve, reject) => {
        let options = {}
        if (conf.voiceName) options.voiceName = conf.voiceName
        if (conf.rate) options.rate = Number(conf.rate)
        if (conf.pitch) options.pitch = Number(conf.pitch)
        debug(conf, options)
        let arr = sliceStr(text, 128)
        let lastKey = arr.length - 1
        arr.forEach((v, k) => {
            options.onEvent = function (e) {
                // console.log('onEvent:', lastKey, k, v, e.type, options)
                if (e.type === 'end') {
                    if (k === lastKey) resolve()
                } else if (e.type === 'error') {
                    debug('speak error:', e.errorMessage)
                    reject(e.errorMessage)
                }
            }
            if (k === 0) {
                chrome.tts.speak(v, options)
            } else {
                chrome.tts.speak(v, Object.assign({enqueue: true}, options))
            }
        })
    })
}

function stop() {
    chrome.tts.stop()
}

function sliceStr(text, maxLen) {
    let r = []
    if (text.length <= maxLen) {
        r.push(text)
    } else {
        // 根据优先级截取字符串，详细符号见：https://zh.wikipedia.org/wiki/%E6%A0%87%E7%82%B9%E7%AC%A6%E5%8F%B7
        let separators = `.。!！?？;；-－－＿…～﹏﹏,，：/、·"`
        separators += `“”﹃﹄「」﹁﹂『』﹃﹄（）［］〔〕【】《》〈〉()[]{}`
        let separatorArr = [...separators]
        let arr = text.split('\n')
        arr.forEach(s => {
            s = s.trim()
            if (!s) return

            if (s.length <= maxLen) {
                r.push(s)
            } else {
                do {
                    if (s.length <= maxLen) {
                        r.push(s)
                        break
                    }
                    let end = false
                    for (let i = 0; i < separatorArr.length; i++) {
                        if (i + 1 === separatorArr.length) end = true
                        let symbol = separatorArr[i]
                        let n = s.indexOf(symbol)
                        if (n === -1) continue
                        if (n > maxLen) continue
                        let s2 = s.substring(0, n).trim()
                        s2 && r.push(s2)
                        s = s.substring(n + 1).trim()
                        break
                    }
                    if (!end) continue
                    if (!s) break
                    if (s.length <= maxLen) {
                        r.push(s)
                        break
                    }

                    let s1 = s.substring(0, maxLen)
                    let s2 = s.substring(maxLen)
                    let n = s1.lastIndexOf(' ')
                    if (n !== -1) {
                        // 处理英文
                        let s3 = s1.substring(0, n)
                        let s4 = s1.substring(n)
                        r.push(s3)
                        s = (s4 + s2).trim()
                    } else {
                        // 没有空格，就硬切（这种情况一般是中文）
                        r.push(s1)
                        s = s2
                    }
                } while (s)
            }
        })
    }
    return r
}
