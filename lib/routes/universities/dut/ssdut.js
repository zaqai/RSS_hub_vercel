const got = require('@/utils/got');
const cheerio = require('cheerio');
const url = require('url');
 
// 域名
const host = 'http://ss.dlut.edu.cn';
 
// 分类
const map = {
    bkstz: '/index/bkstz.htm',
    xytz: '/index/xytz.htm',
};


 
module.exports = async (ctx) => {
    // 这里获取到传入的参数，也就是 /ncu/jwc/:type? 中的 type
    // 通过 || 来实现设置一个默认值
    const type = ctx.params.type || 'bkstz';
 
    // 要抓取的网址
    const link = host + map[type] ;
 
     // 获取列表页，也就是发出请求，来获得这个文章列表页
    const response = await got({
        method: 'get',    // 请求的方法是 get，这里一般都是 get
        url: link,        // 请求的链接，也就是文章列表页
    });

    // 用 cheerio 来把请求回来的数据转成 DOM，方便操作
    const $ = cheerio.load(response.data);
 
    // 提取列表项
    const urlList = $('.c_hzjl_list1')    // 筛选出所有 class=".c_hzjl_list1" 的内容
        .find('a')                // 找到所有 <a> 标签，也就是文章的链接
        .slice(0, 25)             // 获取 10 个，也可以把它调大一点，比如 15 个。最大的个数要看这个网页中有多少条
        .map((i, e) => $(e).attr('href'))    // 作为键值对来存储 <a> 标签们的 href 属性
        .get();

    // 要输出的文章内容保存到 out 中
    const out = await Promise.all(
        // 抓取操作放这里
        urlList.map(async (itemUrl) => {
            // 获取文章的完整链接
            itemUrl = url.resolve(host+map[type] , itemUrl);
 
            // 这里是使用 RSSHub 的缓存机制
            const cache = await ctx.cache.get(itemUrl);
            if (cache) {
                return Promise.resolve(JSON.parse(cache));
            }
 
            // 获取列表项中的网页
            const response = await got.get(itemUrl);
            const $ = cheerio.load(response.data);
 
            // single 就是一篇文章了，里面包括了标题、链接、内容和时间
            const single = {
                title: $('title').text(),      // 提取标题
                link: itemUrl,                 // 文章链接
                description: $('.v_news_content')        // 文章内容，并且用了个将文章的链接和图片转成完整路径的 replace() 方法
                    .html()
                    .replace(/src="\//g, `src="${url.resolve(host, '.')}`)
                    .replace(/href="\//g, `href="${url.resolve(host, '.')}`)
                    .trim(),
                pubDate: new Date(
                        $('.mt_15, .mb_15, .mt_10, .mb_10')
                        .text()
                        .match(/[1-9][0-9]{3}年[0-9]{2}月[0-9]{2}日/).toString()
                        .match(/[1-9][0-9]{3}/)+'-'+
                        $('.mt_15, .mb_15, .mt_10, .mb_10')
                        .text()
                        .match(/[1-9][0-9]{3}年[0-9]{2}月[0-9]{2}日/).toString()
                        .match(/[0-9]{2}/g)[2]+'-'+                        
                        $('.mt_15, .mb_15, .mt_10, .mb_10')
                        .text()
                        .match(/[1-9][0-9]{3}年[0-9]{2}月[0-9]{2}日/).toString()
                        .match(/[0-9]{2}/g)[3]            

                ).toUTCString(),                                     // 将时间的文本文字转换成 Date 对象
            };
 
            // 设置缓存及时间
            ctx.cache.set(itemUrl, JSON.stringify(single), 24 * 60 * 60);
 
            // 输出一篇文章的所有信息
            return Promise.resolve(single);
        })
    );
 
    // 设置分类的标题
    let info = '本科生通知';
    if (type === 'xytz') {
        info = '学院通知';
    }
 
    // 访问 RSS 链接时会输出的信息
    ctx.state.data = {
        title: '大工软院 - ' + info,
        link: link,
        description: '大工软院 - ' + info + ' ss.dlut.edu.cn',
        item: out,
    };
}
