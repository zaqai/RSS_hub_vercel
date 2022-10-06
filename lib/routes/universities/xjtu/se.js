const got = require('@/utils/got')
const cheerio = require('cheerio')
const url = require('url')

// 域名
const host = 'http://se.xjtu.edu.cn'

// 分类
const map = {
    tzgg: '/list.jsp?urltype=tree.TreeTempUrl&wbtreeid=1043', //通知公告
    xwxx: '/list.jsp?urltype=tree.TreeTempUrl&wbtreeid=1044', //新闻信息
    yjsjw: '/list.jsp?urltype=tree.TreeTempUrl&wbtreeid=1014', //研究生教务
    sxxx: '/list.jsp?urltype=tree.TreeTempUrl&wbtreeid=1032', //实习信息
}
const infoMap = {
    tzgg: '通知公告',
    xwxx: '新闻信息',
    yjsjw: '研究生教务',
    sxxx: '实习信息',
}


module.exports = async (ctx) => {
    // 这里获取到传入的参数，也就是 /ncu/jwc/:type? 中的 type
    // 通过 || 来实现设置一个默认值
    const type = ctx.params.type || 'tzgg'

    // 要抓取的网址
    const link = host + map[type]

    // 获取列表页，也就是发出请求，来获得这个文章列表页
    const response = await got({
        method: 'get',    // 请求的方法是 get，这里一般都是 get
        url: link,        // 请求的链接，也就是文章列表页
    })

    // 用 cheerio 来把请求回来的数据转成 DOM，方便操作
    const $ = cheerio.load(response.data)

    // 提取列表项
    const urlList = $('.list_r_d')    // 筛选出所有 class=".list_r_d" 的内容
        .find('ul li a')                // 找到所有 <a> 标签，也就是文章的链接
        .slice(0, 15)             // 获取 10 个，也可以把它调大一点，比如 15 个。最大的个数要看这个网页中有多少条
        .map((i, e) => $(e).attr('href'))    // 作为键值对来存储 <a> 标签们的 href 属性
        .get()

    // 要输出的文章内容保存到 out 中
    const out = await Promise.all(
        // 抓取操作放这里
        urlList.map(async (itemUrl) => {
            // 获取文章的完整链接
            itemUrl = url.resolve(host + map[type], itemUrl)

            // 这里是使用 RSSHub 的缓存机制
            const cache = await ctx.cache.get(itemUrl)
            if (cache) {
                return Promise.resolve(JSON.parse(cache))
            }

            // 获取列表项中的网页
            const response = await got.get(itemUrl)
            const $ = cheerio.load(response.data)

            // single 就是一篇文章了，里面包括了标题、链接、内容和时间
            const single = {
                title: $('.c66378_title').text(),      // 提取标题
                link: itemUrl,                 // 文章链接
                description: $('#vsb_content')        // 文章内容，并且用了个将文章的链接和图片转成完整路径的 replace() 方法
                    .html()
                    .replace(/src="\//g, `src="${url.resolve(host, '.')}`)
                    .replace(/href="\//g, `href="${url.resolve(host, '.')}`)
                    .trim(),
                pubDate: $('.c66378_date').text().split('：')[1].trim(),                                     // 将时间的文本文字转换成 Date 对象
            }

            // 设置缓存及时间
            ctx.cache.set(itemUrl, JSON.stringify(single), 24 * 60 * 60)

            // 输出一篇文章的所有信息
            return Promise.resolve(single)
        })
    )

    // 访问 RSS 链接时会输出的信息
    ctx.state.data = {
        title: '西交软院 - ' + infoMap[type],
        link: link,
        description: '西交软院 - ' + infoMap[type] + ' se.xjtu.edu.cn',
        item: out,
    }
}