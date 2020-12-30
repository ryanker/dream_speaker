'use strict'

let setting = {}
let autoSpeakHost = ''
let first, nodeIndex, nextHref, nextBody, nextTitle
document.addEventListener('DOMContentLoaded', async function () {
    await storageLocalGet(['setting', 'autoSpeakHost']).then(r => {
        setting = r.setting || {} // 设置信息
        autoSpeakHost = r.autoSpeakHost // 自动播放记录的域名
    })

    init()
})

B.onMessage.addListener(function (m) {
    debug('m:', m)
    if (m.action === 'speak') {
        speak()
    } else if (m.action === 'speakStart') {
        first = true
        nodeIndex = 0
        autoSpeakHost = '' // 初始为空
        speak()
    }
})

// 监听设置修改
B.storage.onChanged.addListener(function (data) {
    let keys = Object.keys(data)
    keys.forEach(k => {
        let v = data[k].newValue
        if (k === 'setting') {
            setting = v
        } else if (k === 'autoSpeakHost') {
            autoSpeakHost = v
        }
        debug('new:', k, v)
    })
})

// 划词朗读
document.addEventListener('mouseup', function () {
    if (!setting.isScribble) return
    let text = getSelection().toString().trim()
    if (!text) return
    sendMessage({action: 'scribbleSpeak', text: text})
})

// 初始化
function init() {
    first = true
    nodeIndex = 0
    nextHref = ''
    nextBody = null

    // 是否自动开始朗读
    if (setting.autoSpeak) {
        setTimeout(() => {
            speak()
        }, 1000)
    }

    // 预加载下一页
    if (setting.enablePreload) {
        setTimeout(() => {
            nextHref = getNextHref()
            if (nextHref) preloadNext(nextHref)
        }, 1500)
    }

    // 解除页面限制
    setting.allowSelect && allowUserSelect()
}

// 朗读文本
function speak() {
    debug('reading...')
    let cEl = getContentEl()
    if (!cEl) return

    // 第一次自动朗读时，记录域名，防止访问其他网站时，覆盖朗读进度
    if (!autoSpeakHost) {
        autoSpeakHost = location.host
        storageLocalSet({autoSpeakHost}) // 记录域名
    }
    if (location.host !== autoSpeakHost) return // 域名不匹配，不朗读

    // 遍历定位朗读
    let sel = window.getSelection()
    let range = document.createRange()
    let nodes = cEl.childNodes
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
            // 去掉起点小说的评论数
            let rcEl = node.querySelector('span.review-count')
            if (rcEl) rcEl.remove()

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
            let s = sel.toString()
            if (s) s = s.trim()
            if (s) {
                let sRange = sel.getRangeAt(0)
                if (sRange) {
                    let bcr = sRange.getBoundingClientRect()
                    document.scrollingElement.scrollTop = document.scrollingElement.scrollTop + bcr.top - 10
                }
            }

            // 朗读内容
            if (first) {
                first = false
                let tEl = S('h1')
                if (tEl) {
                    let title = tEl.innerText.trim()
                    if (title) text = title + '\n' + text
                }
            }
            hasWords(text) && sendMessage({action: 'speak', text: text})
            break
        }
    }
    if (!isText) toNext() // 如果循环全部节点都没文本，就翻页
}

// 获取正确的小说内容元素
function getContentEl() {
    let el
    for (let id of ['cont-text', 'chaptercontent', 'content', 'BookText']) {
        el = $(id) // 精准类型小说网站
        if (el) break
    }

    // 检测是不是正确的小说内容
    let getLines = function (el) {
        let n = 0
        el.childNodes.forEach(e => {
            if (e.nodeName === 'P') n++
            else if (e.nodeName === '#text' && e.textContent.trim()) n++
            else if (e.nodeName === 'DIV' && e.className === '') n++
        })
        return n
    }
    let checkContent = function (el) {
        if (!el.innerText) return false
        if (el.innerText.trim().length < 100) return false // 小于 100 字
        // if (el.getElementsByTagName('img').length > 0) return false // 含有图片
        if (el.querySelectorAll('h1,h2,h3,h4,h5,h6').length > 0) return false // 含有标题标签
        if (el.querySelectorAll('ul,li,dl,dt,dd').length > 0) return false // 含有列表标签
        if (el.querySelectorAll('style,table').length > 0) return false // 排除样式和表格
        if (el.className && inArray('copy', el.className)) return false // 排除版权信息
        return getLines(el) > 1
    }

    if (el && checkContent(el)) return el

    // 模糊匹配，较耗资源
    let arr = []
    // A('div[id]').forEach(el => {
    //     if (checkContent(el)) arr.push(el) // 看一下合规的元素有多少
    // })
    // if (arr.length === 1) return arr[0] // 如果只有一个，就直接返回

    // 超级模糊匹配，更耗资源
    if (arr.length === 0) {
        A('div').forEach(el => {
            if (checkContent(el)) arr.push(el) // 看一下合规的元素有多少
        })
        if (arr.length === 1) return arr[0] // 如果只有一个，就直接返回
    }

    // 有多个，那就进行排序筛选
    if (arr.length > 1) {
        arr.sort((a, b) => b.innerText.trim().length - a.innerText.trim().length) // 字符大小排序
        arr.sort((a, b) => getLines(b) - getLines(a)) // 有效段落排序
        return arr[0]
    }
    return null
}

// 跳转到下一章
function toNext() {
    if (setting.enablePreload && nextBody) {
        let el = S('body')
        if (!el) return
        el.innerHTML = nextBody // 修改页面内容
        S('title').innerText = nextTitle // 修改页面标题
        document.scrollingElement.scrollTop = 0 // 返回顶部
        history.pushState(null, nextTitle, nextHref) // 修改 URL
        setTimeout(init, 500)
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
        if (el.id === 'next' || inArray(text, ['下一章', '下一页'])) {
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
        if (el) {
            let tEl = r.querySelector('title')
            nextTitle = tEl ? tEl.innerText : ''
            nextBody = el.innerHTML
        }
        // console.log(nextHref, r.querySelector('h1').innerText, nextBody.length)
        // setTimeout(toNext, 10000)
    }).catch(err => {
        debug(err)
    })
}

function allowUserSelect() {
    if (window.dmxAllowUserSelect) return
    let sty = document.createElement('style')
    sty.textContent = `* {-webkit-user-select:text!important;-moz-user-select:text!important;user-select:text!important}`
    document.head.appendChild(sty)

    let onAllow = function (el, event) {
        if (el.getAttribute && el.getAttribute(event)) el.setAttribute(event, () => true)
    }
    let onClean = function (e) {
        e.stopPropagation()
        let el = e.target
        while (el) {
            onAllow(el, 'on' + e.type)
            el = el.parentNode
        }
    }
    onAllow(document, 'oncontextmenu')
    onAllow(document, 'onselectstart')
    document.addEventListener('contextmenu', onClean, true)
    document.addEventListener('selectstart', onClean, true)
    window.dmxAllowUserSelect = true
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
