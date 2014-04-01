var crypto = require('crypto');
var request = require('request');
var debug = require('debug');
var log = debug('exprowebot:log');
var verbose = debug('exprowebot:verbose');
var error = debug('exprowebot:error');
var API = require('wechat').API;
var api = new API(process.env.WX_APPID, process.env.WX_APPSECRET);
var _ = require('underscore')._;
var search = require('../lib/support').search;
var geo2loc = require('../lib/support').geo2loc;

var package_info = require('../package.json');

module.exports = exports = function(webot){
  webot.set({
    name: 'unsubscribe',
    pattern: function(info) {
      return info.is('event') && info.param.event === 'unsubscribe';
    },
    handler: function(info){
      request.del('http://192.168.0.192:8000/member', {form: {
        'weixinID': info.uid
      }}, function (err, res, body) {
        console.log(res.statusCode);
      })
    }
  })

  webot.set({
    name: 'subscribe',
    description: 'user subscribe',
    pattern: function(info) {
      return info.is('event') && info.param.event === 'subscribe';
    },
    handler: function(info){
//      var userInfo = api.getUser(info.uid, function(err, result){
//        console.log(err.message)
//        console.log(result)
//      });
      request.post('http://192.168.0.192:8000/member', {form: {
        'weixinID': info.uid,
        "active": true
      }}, function (err, res, body) {
        console.log(err);
        console.log(res.statusCode);
      })

      var reply = {
        title: '感谢您关注泛商汇',
        pic: 'http://fankahui.oss-cn-hangzhou.aliyuncs.com/small_slide_1.jpg',
        url: 'http://fankahui.com',
        description: [
          '为了将您的微信号与泛商汇会员关联，请输入手机号码'
        ].join('\n')
      };
      // 返回值如果是list，则回复图文消息列表
      return reply;
    },
    replies: {
      '^[1][3548][0-9]{9}': function phoneGot(info){
        request.put('http://192.168.0.192:8000/member', {form: {
          'weixinID': info.uid,
          'phone': info.text
        }}, function(err, res, body) {
          console.log(body)
          console.log(res.statusCode);
          if (res.statusCode == 200)
            return '您的账号已完成关联'
        })
        return '你输入了手机号码:\n' + info.text;
      },
      '/.*/': function reAsk(info) {
        if (info.rewaitCount >= 0) {
          info.rewait();
          return '亲,不要调皮了,请输入11位手机号码';
        }
      }
    }
  });

  function dateSort(a, b) {
    return parseInt(a.date) - parseInt(b.date)
  };

  function bill2String(bill) {
    bill.sort(dateSort);
    for (var i = 0; i < bill.length; i ++) {
      var d = new Date(0);
      d.setUTCDate(bill[i].date)
      bill[i].amount = bill[i].amount / 100;
      bill[i].date = d.getFullYear() + "-" + Number(Number(d.getMonth()) + 1) + "-" + d.getDate();
    }
    return JSON.stringify(bill).replace(/},/g, '\n').
      replace(/"merchantName"/g, "").replace(/"amount"/g, "").
      replace(/"date"/g, "").replace(/{|}|:|"|\[|\]/g, "").
      replace(/,/g, "  ");
  }
  function merchant2String(bill) {
    bill.sort(dateSort);
    for (var i = 0; i < bill.length; i ++) {
      delete bill[0].amount;
    }
    return JSON.stringify(bill).replace(/},/g, '\n').
      replace(/"merchantName"/g, "").replace(/"amount"/g, "").
      replace(/"date"/g, "").replace(/{|}|:|"|\[|\]/g, "").
      replace(/,/g, "  ");
  }

  webot.beforeReply(function load_user(info, next) {
    //week bill
    var qs_bill_w = {
      'weixinID': info.uid,
      'endAt': parseInt(new Date() / (1000*86400)),
      'startAt': parseInt(new Date() / (1000*86400)) - 7,
      'type': 'bill'
    }
    var options_bill_w = {
      url: 'http://192.168.0.192:8000/member',
      method: 'GET',
      json: qs_bill_w
    }
    request(options_bill_w, function (err, res, body) {
      if (res != undefined){
        if (res.statusCode == 200){
          info.bill_w = bill2String(body);
        }
        else if (res.statusCode == 400) {
          info.bill_w = '亲,不要调皮了,不输入手机号是无法绑定泛商汇会员信息的,也就无法查询到想要的东西了';
        }
      } else {
        info.bill_w = '服务器异常，原因为:\n'+err+'\n请向客服吐槽去吧。'
      }
    })
    //ever bill
    var qs_bill_all = {
      'weixinID': info.uid,
      'endAt': parseInt(new Date() / (1000*86400)),
      'startAt': parseInt(new Date() / (1000*86400)) - 30,
      'type': 'bill'
    }
    var options_bill_all = {
      url: 'http://192.168.0.192:8000/member',
      method: 'GET',
      json: qs_bill_all
    }
    request(options_bill_all, function (err, res, body) {
      if (res != undefined){
        if (res.statusCode == 200){
          info.bill_all = bill2String(body);
        }
        else if (res.statusCode == 400){
          info.bill_all = '亲,不要调皮了,不输入手机号是无法绑定泛商汇会员信息的,也就无法查询到想要的东西了';
        }
      } else {
        info.bill_all = '服务器异常，原因为:\n'+err+'\n请向客服吐槽去吧。'
      }
    })
    //balance
    var qs_balance = {
      'weixinID': info.uid,
      'type': 'balance'
    }
    var options_balance = {
      url: 'http://192.168.0.192:8000/member',
      method: 'GET',
      json: qs_balance
    }
    request(options_balance, function (err, res, body) {
      if (res != undefined){
        if (res.statusCode == 200){
          info.balance = body[0].merchantName +"  "+body[0].amount / 100;
        }
        else if (res.statusCode == 400) {
          info.balance = '亲,不要调皮了,不输入手机号是无法绑定泛商汇会员信息的,也就无法查询到想要的东西了';
        }
      } else {
        info.balance = '服务器异常，原因为:\n'+err+'\n请向客服吐槽去吧。'
      }
    })
    //point
    var qs_point = {
      'weixinID': info.uid,
      'type': 'point'
    }
    var options_point = {
      url: 'http://192.168.0.192:8000/member',
      method: 'GET',
      json: qs_point
    }
    request(options_point, function (err, res, body) {
      if (res != undefined){
        if (res.statusCode == 200){
          info.point = body[0].merchantName +"  "+body[0].amount / 100;;
        }
        else if (res.statusCode == 400) {
          info.point = '亲,不要调皮了,不输入手机号是无法绑定泛商汇会员信息的,也就无法查询到想要的东西了';
        }
      } else {
        info.point = '服务器异常，原因为:\n'+err+'\n请向客服吐槽去吧。'
      }
    })
    //merchant
    var qs_merchant = {
      'weixinID': info.uid,
      'type': 'merchant'
    }
    var options_merchant = {
      url: 'http://192.168.0.192:8000/member',
      method: 'GET',
      json: qs_merchant
    }
    request(options_merchant, function (err, res, body) {
      console.log(res.statusCode);
      console.log(body)
      if (res != undefined){
        if (res.statusCode == 200){
          info.merchant = merchant2String(body);
        }
        else if (res.statusCode == 400) {
          info.merchant = '亲,不要调皮了,不输入手机号是无法绑定泛商汇会员信息的,也就无法查询到想要的东西了';
        }
      } else {
        info.merchant = '服务器异常，原因为:\n'+err+'\n请向客服吐槽去吧。'
      }
    })
    //month bill
    var qs_bill_m = {
      'weixinID': info.uid,
      'endAt': parseInt(new Date() / (1000*86400)),
      'startAt': parseInt(new Date() / (1000*86400)) - 30,
      'type': 'bill'
    }
    var options_bill_m = {
      url: 'http://192.168.0.192:8000/member',
      method: 'GET',
      json: qs_bill_m
    }
    request(options_bill_m, function (err, res, body) {
      if (res != undefined){
        if (res.statusCode == 200){
          info.bill_m = bill2String(body);
          next();
        }
        else if (res.statusCode == 400){
          info.bill_m = '亲,不要调皮了,不输入手机号是无法绑定泛商汇会员信息的,也就无法查询到想要的东西了';
          next();
        }
      } else {
        info.bill_m = '服务器异常，原因为:\n'+err+'\n请向客服吐槽去吧。'
        next();
      }
    })
  })

  webot.set({
    name: 'click',
    pattern: function (info){
      return info.is('event')&& info.param.event === 'CLICK';
    },
    handler: function (info) {
      if (info.param.eventKey == 'bill_last_week'){
        return info.bill_w
      }
      else if (info.param.eventKey == 'bill_last_month'){
        return info.bill_m;
      }
      else if (info.param.eventKey == 'bill_all'){
        return info.bill_all;
      }
      else if (info.param.eventKey == 'balance') {
        return info.balance;
      }
      else if (info.param.eventKey == 'point') {
        return info.point;
      }
      else if (info.param.eventKey == 'merchant') {
        return info.merchant;
      }
      else if (info.param.eventKey == 'news')
        return '敬请期待';
    }
  });

  webot.set({
    name: 'Image handle',
    pattern: function(info) {
      return info.is('image');
    },
    handler: function(info){
      console.log('time: ' + parseInt(new Date() / 1000));
      request.post('http://192.168.0.192:8000/message', {form: {
        'weixinID': info.uid,
        'createTime': parseInt(new Date() / 1000),
        'msgType': 'image',
        'content': info.param.picUrl
      }}, function (err, res, body) {
        if (res != undefined){
          console.log(res.statusCode);
          console.log(body);
        }
      })
      return '您的图片我们已经收到，我们会尽快给您回复！';
    }
  });

  webot.set(/.*/, function(info){
    // 利用 error log 收集听不懂的消息，以利于接下来完善规则
    // 你也可以将这些 message 存入数据库
    log('unhandled message: %s', info.text);
    info.flag = true;
    console.log('time: ' + parseInt(new Date() / 1000));
    request.post('http://192.168.0.192:8000/message', {form: {
      'weixinID': info.uid,
      'createTime': parseInt(new Date() / 1000),
      'msgType': 'text',
      'content': info.text
    }}, function (err, res, body) {
      if (res != undefined){
        console.log(res.statusCode);
        console.log(body);
      }
    })
    return '您的消息我们已经收到，我们会尽快给您回复！';
  });

//  更简单地设置一条规则
//  webot.set(/^more$/i, function(info){
//     var reply = _.chain(webot.gets()).filter(function(rule){
//       return rule.description;
//     }).map(function(rule){
//       //console.log(rule.name)
//       return '> ' + rule.description;
//     }).join('\n').value();
//
//     return ['我的主人还没教我太多东西,你可以考虑帮我加下.\n可用的指令:\n'+ reply,
//       '没有更多啦！当前可用指令：\n' + reply];
//  });
//
//  webot.set('who_are_you', {
//     description: '想知道我是谁吗? 发送: who?',
//     // pattern 既可以是函数，也可以是 regexp 或 字符串(模糊匹配)
//     pattern: /who|你是[谁\?]+/i,
//     // 回复handler也可以直接是字符串或数组，如果是数组则随机返回一个子元素
//     handler: ['我是神马机器人', '微信机器人']
//  });
//
//  // 正则匹配后的匹配组存在 info.query 中
//  webot.set('your_name', {
//     description: '自我介绍下吧, 发送: I am [enter_your_name]',
//     pattern: /^(?:my name is|i am|我(?:的名字)?(?:是|叫)?)\s*(.*)$/i,
//
//     // handler: function(info, action){
//     //   return '你好,' + info.param[1]
//     // }
//     // 或者更简单一点
//     handler: '你好,{1}'
//  });
//
//  // 支持一次性加多个（方便后台数据库存储规则）
//  webot.set([{
//     name: 'morning',
//     description: '打个招呼吧, 发送: good morning',
//     pattern: /^(早上?好?|(good )?moring)[啊\!！\.。]*$/i,
//     handler: function(info){
//       var d = new Date();
//       var h = d.getHours();
//       if (h < 3) return '[嘘] 我这边还是深夜呢，别吵着大家了';
//       if (h < 5) return '这才几点钟啊，您就醒了？';
//       if (h < 7) return '早啊官人！您可起得真早呐~ 给你请安了！\n 今天想参加点什么活动呢？';
//       if (h < 9) return 'Morning, sir! 新的一天又开始了！您今天心情怎么样？';
//       if (h < 12) return '这都几点了，还早啊...';
//       if (h < 14) return '人家中午饭都吃过了，还早呐？';
//       if (h < 17) return '如此美好的下午，是很适合出门逛逛的';
//       if (h < 21) return '早，什么早？找碴的找？';
//       if (h >= 21) return '您还是早点睡吧...';
//     }
//  }, {
//     name: 'time',
//     description: '想知道几点吗? 发送: time',
//     pattern: /^(几点了|time)\??$/i,
//     handler: function(info) {
//       var d = new Date();
//       var h = d.getHours();
//       var t = '现在是服务器时间' + h + '点' + d.getMinutes() + '分';
//       if (h < 4 || h > 22) return t + '，夜深了，早点睡吧 [月亮]';
//       if (h < 6) return t + '，您还是再多睡会儿吧';
//       if (h < 9) return t + '，又是一个美好的清晨呢，今天准备去哪里玩呢？';
//       if (h < 12) return t + '，一日之计在于晨，今天要做的事情安排好了吗？';
//       if (h < 15) return t + '，午后的冬日是否特别动人？';
//       if (h < 19) return t + '，又是一个充满活力的下午！今天你的任务完成了吗？';
//       if (h <= 22) return t + '，这样一个美好的夜晚，有没有去看什么演出？';
//       return t;
//     }
//  }]);
//
//  // 等待下一次回复
//  webot.set('guess my sex', {
//     pattern: /是男.还是女.|你.*男的女的/,
//     handler: '你猜猜看呐',
//     replies: {
//       '/女|girl/i': '人家才不是女人呢',
//       '/男|boy/i': '是的，我就是翩翩公子一枚',
//       'both|不男不女': '你丫才不男不女呢',
//       '不猜': '好的，再见',
//       // 请谨慎使用通配符
//       '/.*/': function reguess(info) {
//         if (info.rewaitCount < 2) {
//           info.rewait();
//           return '你到底还猜不猜嘛！';
//         }
//         return '看来你真的不想猜啊';
//       },
//     }
//
//     // 也可以用一个函数搞定:
//     // replies: function(info){
//     //   return 'haha, I wont tell you'
//     // }
//
//     // 也可以是数组格式，每个元素为一条rule
//     // replies: [{
//     //   pattern: '/^g(irl)?\\??$/i',
//     //   handler: '猜错'
//     // },{
//     //   pattern: '/^b(oy)?\\??$/i',
//     //   handler: '猜对了'
//     // },{
//     //   pattern: 'both',
//     //   handler: '对你无语...'
//     // }]
//  });
//
//  // 定义一个 wait rule
//  webot.waitRule('wait_guess', function(info) {
//     var r = Number(info.text);
//
//     // 用户不想玩了...
//     if (isNaN(r)) {
//       info.resolve();
//       return null;
//     }
//
//     var num = info.session.guess_answer;
//
//     if (r === num) {
//       return '你真聪明!';
//     }
//
//     var rewaitCount = info.session.rewait_count || 0;
//     if (rewaitCount >= 2) {
//       return '怎么这样都猜不出来！答案是 ' + num + ' 啊！';
//     }
//
//     //重试
//     info.rewait();
//     return (r > num ? '大了': '小了') +',还有' + (2 - rewaitCount) + '次机会,再猜.';
//  });
//
//  webot.set('guess number', {
//     description: '发送: game , 玩玩猜数字的游戏吧',
//     pattern: /(?:game|玩?游戏)\s*(\d*)/,
//     handler: function(info){
//       //等待下一次回复
//       var num = Number(info.param[1]) || _.random(1,9);
//
//       verbose('answer is: ' + num);
//
//       info.session.guess_answer = num;
//
//       info.wait('wait_guess');
//       return '玩玩猜数字的游戏吧, 1~9,选一个';
//     }
//  });
//
//  webot.waitRule('wait_suggest_keyword', function(info, next){
//     if (!info.text) {
//       return next();
//     }
//
//     // 按照定义规则的 name 获取其他 handler
//     var rule_search = webot.get('search');
//
//     // 用户回复回来的消息
//     if (info.text.match(/^(好|要|y)$/i)) {
//       // 修改回复消息的匹配文本，传入搜索命令执行
//       info.param[0] = 's nodejs';
//       info.param[1] = 'nodejs';
//
//       // 执行某条规则
//       webot.exec(info, rule_search, next);
//       // 也可以调用 rule 的 exec 方法
//       // rule_search.exec(info, next);
//     } else {
//       info.param[1] = info.session.last_search_word;
//       // 或者直接调用 handler :
//       rule_search.handler(info, next);
//       // 甚至直接用命名好的 function name 来调用：
//       // do_search(info, next);
//     }
//     // remember to clean your session object.
//     delete info.session.last_search_word;
//  });
//  // 调用已有的action
//  webot.set('suggest keyword', {
//     description: '发送: s nde ,然后再回复Y或其他',
//     pattern: /^(?:搜索?|search|s\b)\s*(.+)/i,
//     handler: function(info){
//       var q = info.param[1];
//       if (q === 'nde') {
//         info.session.last_search_word = q;
//         info.wait('wait_suggest_keyword');
//         return '你输入了:' + q + '，似乎拼写错误。要我帮你更改为「nodejs」并搜索吗?';
//       }
//     }
//  });
//
//  function do_search(info, next){
//     // pattern的解析结果将放在param里
//     var q = info.param[1];
//     log('searching: ', q);
//     // 从某个地方搜索到数据...
//     return search(q , next);
//  }
//
//  // 可以通过回调返回结果
//  webot.set('search', {
//     description: '发送: s 关键词 ',
//     pattern: /^(?:搜索?|search|百度|s\b)\s*(.+)/i,
//     //handler也可以是异步的
//     handler: do_search
//  });
//
//
//  webot.waitRule('wait_timeout', function(info) {
//     if (new Date().getTime() - info.session.wait_begin > 5000) {
//       delete info.session.wait_begin;
//       return '你的操作超时了,请重新输入';
//     } else {
//       return '你在规定时限里面输入了: ' + info.text;
//     }
//  });
//
//  // 超时处理
//  webot.set('timeout', {
//     description: '输入timeout, 等待5秒后回复,会提示超时',
//     pattern: 'timeout',
//     handler: function(info) {
//       info.session.wait_begin = new Date().getTime();
//       info.wait('wait_timeout');
//       return '请等待5秒后回复';
//     }
//  });
//
//  /**
//    * Wait rules as lists
//    *
//    * 实现类似电话客服的自动应答流程
//    *
//    */
//  webot.set(/^ok webot$/i, function(info) {
//     info.wait('list');
//     return '可用指令：\n' +
//            '1 - 查看程序信息\n' +
//            '2 - 进入名字选择';
//  });
//  webot.waitRule('list', {
//     '1': 'webot ' + package_info.version,
//     '2': function(info) {
//       info.wait('list-2');
//       return '请选择人名:\n' +
//              '1 - Marry\n' +
//              '2 - Jane\n' +
//              '3 - 自定义'
//     }
//  });
//  webot.waitRule('list-2', {
//     '1': '你选择了 Marry',
//     '2': '你选择了 Jane',
//     '3': function(info) {
//       info.wait('list-2-3');
//       return '请输入你想要的人';
//     }
//  });
//  webot.waitRule('list-2-3', function(info) {
//     if (info.text) {
//       return '你输入了 ' + info.text;
//     }
//  });
//
//
//  //支持location消息 此examples使用的是高德地图的API
//  //http://restapi.amap.com/rgeocode/simple?resType=json&encode=utf-8&range=3000&roadnum=0&crossnum=0&poinum=0&retvalue=1&sid=7001&region=113.24%2C23.08
//  webot.set('check_location', {
//     description: '发送你的经纬度,我会查询你的位置',
//     pattern: function(info){
//       return info.is('location');
//     },
//     handler: function(info, next){
//       geo2loc(info.param, function(err, location, data) {
//         location = location || info.label;
//         next(null, location ? '你正在' + location : '我不知道你在什么地方。');
//       });
//     }
//  });
//
//  //图片
//  webot.set('check_image', {
//     description: '发送图片,我将返回其hash值',
//     pattern: function(info){
//       return info.is('image');
//     },
//     handler: function(info, next){
//       verbose('image url: %s', info.param.picUrl);
//       try{
//         var shasum = crypto.createHash('md5');
//
//         var req = require('request')(info.param.picUrl);
//
//         req.on('data', function(data) {
//           shasum.update(data);
//         });
//         req.on('end', function() {
//           return next(null, '你的图片hash: ' + shasum.digest('hex'));
//         });
//       }catch(e){
//         error('Failed hashing image: %s', e)
//         return '生成图片hash失败: ' + e;
//       }
//     }
//  });
//
//  // 回复图文消息
//  webot.set('reply_news', {
//     description: '发送news,我将回复图文消息你',
//     pattern: /^news\s*(\d*)$/,
//     handler: function(info){
//       var reply = [
//         {title: '微信机器人', description: '微信机器人测试帐号：webot', pic: 'https://raw.github.com/node-webot/exprowebot/master/qrcode.jpg', url: 'https://github.com/node-webot/exprowebot'},
//         {title: '豆瓣同城微信帐号', description: '豆瓣同城微信帐号二维码：douban-event', pic: 'http://i.imgur.com/ijE19.jpg', url: 'https://github.com/node-webot/weixin-robot'},
//         {title: '图文消息3', description: '图文消息描述3', pic: 'https://raw.github.com/node-webot/exprowebot/master/qrcode.jpg', url: 'http://www.baidu.com'}
//       ];
//       // 发送 "news 1" 时只回复一条图文消息
//       return Number(info.param[1]) == 1 ? reply[0] : reply;
//     }
//  });
//
//  // 可以指定图文消息的映射关系
//  webot.config.mapping = function(item, index, info){
//     //item.title = (index+1) + '> ' + item.title;
//     return item;
//  };

  //所有消息都无法匹配时的fallback

};
