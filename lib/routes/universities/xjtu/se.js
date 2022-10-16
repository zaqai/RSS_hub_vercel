const got = require('@/utils/got')
const cheerio = require('cheerio')
const { parseDate } = require('@/utils/parse-date')
const timezone = require('@/utils/timezone')
// 分类
const map = {
    "tzgg": '1043', //通知公告
    "xwxx": '1044', //新闻信息
    "yjsjw": '1014', //研究生教务
    "sxxx": '1032', //实习信息
}
const infoMap = {
    "tzgg": '通知公告',
    "xwxx": '新闻信息',
    "yjsjw": '研究生教务',
    "sxxx": '实习信息',
}

module.exports = async (ctx) => {
    const type = ctx.params.id || 'tzgg'
    const rootUrl = `http://se.xjtu.edu.cn/list.jsp?urltype=tree.TreeTempUrl&wbtreeid=${map[type]}`
    const baseUrl = 'http://se.xjtu.edu.cn'

    const list_response = await got.get(rootUrl)
    const $ = cheerio.load(list_response.data)

    const feed_title = $('span.windowstyle67278', "div[class='list_right fr']").text().trim()

    const list = $("div[class='list_right fr'] ul li")
        .slice(0, 10)
        .map((_, item) => {
            item = $(item)
            const a = item.find('a')
            const date = parseDate(item.find('span').text())
            return {
                title: a.text(),
                link: new URL(a.attr('href'), baseUrl),
                pubDate: timezone(date, +8),
            }
        })
        .get()

    ctx.state.data = {
        title: `西安交通大学软件学院 - ${feed_title}`,
        link: baseUrl,
        item: await Promise.all(
            list.map((item) =>
                ctx.cache.tryGet(item.link, async () => {
                    const res = await got.get(item.link)
                    const content = cheerio.load(res.data)
                    item.description = content('td.contentstyle67362', 'form').html()
                    return item
                })
            )
        ),
    }
}
