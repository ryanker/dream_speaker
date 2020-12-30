'use strict'
let bg = B.getBackgroundPage()
let setting = bg.setting
let langList = {}, speakList = [{key: '', val: '默认'}]

let speak_voice = $('speak_voice')
let speak_play = $('speak_play')
let speak_pause = $('speak_pause')
let speak_stop = $('speak_stop')
document.addEventListener('DOMContentLoaded', async function () {
    // 生成朗读列表
    let pushSpeak = function (obj, name) {
        for (let [key, val] of Object.entries(obj)) speakList.push({key: `${name}:${key}`, val})
    }
    await fetch('conf/speak.json').then(r => r.json()).then(r => {
        r.baidu && pushSpeak(r.baidu, 'baidu') // 百度朗读
        r.youdao && pushSpeak(r.youdao, 'youdao') // 有道朗读
        r.sogou && pushSpeak(r.sogou, 'sogou') // 搜索朗读
        r.google && pushSpeak(r.google, 'google') // 谷歌朗读
    })
    if (!isFirefox) {
        await fetch('conf/language.json').then(r => r.json()).then(r => langList = r) // 语言列表

        let voiceObj = {}
        await getVoices().then(r => voiceObj = r) // 本地朗读
        for (const [key, val] of Object.entries(voiceObj)) {
            let langName = langList[key] ? langList[key].zhName : key
            val.forEach(v => speakList.push({
                key: `local:${key}:${v.voiceName}`,
                val: `${langName} | ${v.voiceName}${v.remote ? ' | 远程' : ''}`
            }))
        }
    }
    // console.log(speakList)

    // 生成下拉框显示
    let initVoiceSelect = function () {
        speak_voice.innerText = ''
        speakList.forEach(v => {
            if (setting.speakLang && !inArray(setting.speakLang, v.val)) return // 排除其他语言
            let el = document.createElement('option')
            el.value = v.key
            el.innerText = v.val
            speak_voice.appendChild(el)
        })

        // 初始设置
        if (setting.speakName && speak_voice.querySelector(`option[value="${setting.speakName}"]`)) {
            speak_voice.value = setting.speakName
        } else {
            let firstEl = speak_voice.querySelector(`option`)
            if (firstEl) firstEl.click()
        }
    }
    setTimeout(initVoiceSelect, 10)

    // 初始设置 & 绑定事件
    A('select[name],input[name="limitWords"]').forEach(el => {
        let name = el.getAttribute('name')
        if (!setting.limitWords) setting.limitWords = 200 // 默认值 200
        if (setting[name]) el.value = setting[name] // 初始设置
        el.onchange = function () {
            let val = this.value
            if (name === 'limitWords' && (isNaN(Number(val)) || val < 100)) {
                val = 100 // 限制不能小于100
                this.value = val
            }
            setSetting(name, val)
            if (name === 'speakLang') initVoiceSelect()
        }
    })
    A('input[type=checkbox][name]').forEach(el => {
        let name = el.getAttribute('name')
        if (setting[name]) el.checked = setting[name] // 初始设置
        el.onclick = function () {
            setSetting(name, this.checked)
        }
    })

    // 开始朗读
    speak_play.onclick = function () {
        speak_pause.innerText = '暂停朗读'
        getActiveTabId().then(tabId => sendTabMessage(tabId, {action: 'speakStart'})) // 开始播放
        removeSpeakHost()
    }

    // 暂停朗读 / 恢复朗读
    if (bg.playOptions && bg.playOptions.status === 'pause') speak_pause.innerText = '恢复朗读'
    speak_pause.onclick = function () {
        if (this.innerText === '暂停朗读') {
            speak_pause.innerText = '恢复朗读'
            bg.speakPause()
        } else {
            speak_pause.innerText = '暂停朗读'
            bg.speakResume()
        }
    }

    // 停止朗读
    speak_stop.onclick = function () {
        speak_pause.innerText = '暂停朗读'
        bg.speakStop()
        removeSpeakHost()
    }
})

// 清空自动朗读时记录的域名
function removeSpeakHost() {
    storageLocalSet({autoSpeakHost: ''})
}

function setSetting(key, value) {
    setting[key] = value
    storageLocalSet({setting})
}

function $(id) {
    return document.getElementById(id)
}

function A(s) {
    return document.querySelectorAll(s)
}
