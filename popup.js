'use strict'
let bg = chrome.extension.getBackgroundPage()
let conf = bg.conf
let langList = bg.langList
let voiceList = bg.voiceList

document.addEventListener('DOMContentLoaded', function () {
    let speak_voice = $('speak_voice')
    let speak_play = $('speak_play')
    let speak_pause = $('speak_pause')
    let speak_stop = $('speak_stop')
    for (const [key, val] of Object.entries(voiceList)) {
        val.forEach(v => {
            let op = document.createElement('option')
            op.value = v.voiceName
            op.innerText = `${langList[key] ? langList[key].zhName : key} | ${v.voiceName}${v.remote ? ' | 远程' : ''}`
            speak_voice.appendChild(op)
        })
    }

    // 绑定事件
    let removeSpeakHost = function () {
        chrome.storage.local.set({autoSpeakHost: ''}) // 清空自动朗读时记录的域名
    }
    let selectEl = document.querySelectorAll('select')
    selectEl.forEach(el => {
        let key = el.getAttribute('key')
        if (conf[key]) el.value = conf[key]
        el.onchange = function () {
            bg.setConf(key, this.value)
        }
    })
    speak_play.onclick = function () {
        removeSpeakHost()
        bg.currentTabMessage({action: 'speakStart'})
        resetPause()
    }
    if (localStorage.getItem('pause')) speak_pause.innerText = '恢复朗读'
    let resetPause = function () {
        this.innerText = '暂停朗读'
        localStorage.setItem('pause', '')
    }
    speak_pause.onclick = function () {
        if (this.innerText === '暂停朗读') {
            bg.pause()
            this.innerText = '恢复朗读'
            localStorage.setItem('pause', '1')
        } else {
            bg.resume()
            resetPause()
        }
    }
    speak_stop.onclick = function () {
        removeSpeakHost()
        bg.stop()
        resetPause()
    }

    // 初始值
    chrome.storage.local.get(['isScribble', 'autoSpeak', 'enablePreload', 'superMatch', 'allowSelect'], function (r) {
        if (r.isScribble) S('input[name="isScribble"]').checked = true
        if (r.autoSpeak) S('input[name="autoSpeak"]').checked = true
        if (r.enablePreload) S('input[name="enablePreload"]').checked = true
        if (r.superMatch) S('input[name="superMatch"]').checked = true
        if (r.allowSelect) S('input[name="allowSelect"]').checked = true
    })

    // 绑定事件
    document.querySelectorAll('input[name]').forEach(el => {
        el.onclick = function () {
            let name = this.getAttribute('name')
            let obj = {}
            obj[name] = this.checked
            chrome.storage.local.set(obj, function () {
                !chrome.runtime.lastError && bg.currentTabMessage({action: 'loadStorage'})
            })
        }
    })
})

function $(id) {
    return document.getElementById(id)
}

function S(s) {
    return document.querySelector(s)
}
