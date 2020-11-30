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
    let autoSpeak = document.querySelector('input[name="autoSpeak"]')
    for (const [key, val] of Object.entries(voiceList)) {
        val.forEach(v => {
            let op = document.createElement('option')
            op.value = v.voiceName
            op.innerText = `${langList[key] ? langList[key].zhName : key} | ${v.voiceName}${v.remote ? ' | 远程' : ''}`
            speak_voice.appendChild(op)
        })
    }

    // 绑定事件
    let selectEl = document.querySelectorAll('select')
    selectEl.forEach(el => {
        let key = el.getAttribute('key')
        if (conf[key]) el.value = conf[key]
        el.onchange = function () {
            bg.setConf(key, this.value)
        }
    })
    speak_play.onclick = function () {
        bg.currentTabMessage({action: 'speakStart'})
        speak_pause.innerText = '暂停朗读'
    }
    speak_pause.onclick = function () {
        if (this.innerText === '暂停朗读') {
            bg.pause()
            this.innerText = '恢复朗读'
        } else {
            bg.resume()
            this.innerText = '暂停朗读'
        }
    }
    speak_stop.onclick = function () {
        bg.stop()
        speak_pause.innerText = '暂停朗读'
    }

    // 自动朗读
    autoSpeak.onclick = function () {
        chrome.storage.local.set({'autoSpeak': this.checked ? 'on' : ''})
    }
    chrome.storage.local.get('autoSpeak', function (r) {
        if (r.autoSpeak === 'on') autoSpeak.checked = true
    })
})

function $(id) {
    return document.getElementById(id)
}
