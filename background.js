'use strict'

var isDebug = false
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

// 添加上下文菜单
chrome.contextMenus.create({
    "title": "朗读“%s”",
    "contexts": ["selection"],
    "onclick": function (info) {
        speak(info.selectionText).catch(err => {
            debug('speak error:', err)
            notifications('朗读出错', '朗读选中文本出错')
        })
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
            sendMessage(tabId, {action: 'speak'})
        }).catch(err => {
            debug('speak error:', err)
            notifications('朗读出错', '朗读小说出错')
        })
    } else if (m.action === 'scribbleSpeak') {
        speak(m.text).catch(err => {
            debug('speak error:', err)
            notifications('朗读出错', '朗读选中文本出错')
        })
    }
})

function notifications(title, message) {
    chrome.notifications.create('readerNotification', {
        "type": "basic",
        "iconUrl": '256.png',
        "title": title,
        "message": message
    })
}

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

// 开始朗读
function speak(text) {
    return new Promise((resolve, reject) => {
        chrome.tts.isSpeaking(function (speaking) {
            if (speaking) stop()

            let options = {}
            if (conf.voiceName) options.voiceName = conf.voiceName
            if (conf.rate) options.rate = Number(conf.rate)
            if (conf.pitch) options.pitch = Number(conf.pitch)
            let arr = sliceStr(text, 128)
            let lastKey = arr.length - 1
            arr.forEach((v, k) => {
                debug(k, v)
                options.onEvent = function (e) {
                    // ((e, k) => {
                    // debug('onEvent:', e)
                    if (e.type === 'end') {
                        debug('end:', k, lastKey)
                        if (k === lastKey) {
                            chrome.browserAction.setBadgeText({text: ''})
                            resolve()
                        }
                    } else if (e.type === 'error') {
                        debug('speak error:', e.errorMessage)
                        reject(e.errorMessage)
                    }
                    // })(e, k)
                }
                if (k === 0) {
                    chrome.browserAction.setBadgeText({text: '读'})
                    chrome.browserAction.setBadgeBackgroundColor({color: 'red'})
                    chrome.tts.speak(v, options)
                } else {
                    chrome.tts.speak(v, Object.assign({enqueue: true}, options))
                }
            })
        })
    })
}

// 停止朗读
function stop() {
    chrome.browserAction.setBadgeText({text: ''})
    chrome.tts.stop()
}

// 暂停朗读
function pause() {
    chrome.tts.pause()
}

// 恢复朗读
function resume() {
    chrome.tts.resume()
}

function sliceStr(text, maxLen) {
    let r = []
    if (text.length <= maxLen) {
        r.push(text)
    } else {
        // 根据优先级截取字符串，详细符号见：https://zh.wikipedia.org/wiki/%E6%A0%87%E7%82%B9%E7%AC%A6%E5%8F%B7
        let separators = `！？。；－－＿～﹏，：/、·`
        separators += `!?.;-…,"`
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
