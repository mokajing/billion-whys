// V8.14 第82轮 Sprint 23：MP 端极简 i18n helper（与 H5 src/h5/utils/i18n.js 同构）
// V8.17 第85轮 Sprint 26：DICT 扩展到 43 key，覆盖 Discover/Ask/QuestionDetail UI chrome
// V8.18 第86轮 Sprint 27：DICT 扩展到 130 key，新增 Archive 26 + Profile 35（NotFound 不适用 MP；隐私政策正文留 V9）
// V8.19 第87轮 Sprint 28：DICT 扩展到 160 key，新增 Profile streakMessage 6 + weekday 7 + monthShort 12 + dayLabel 2 + detailHeader 3（i18n 第三批，与 H5 同构）
// V8.21 第89轮 Sprint 30：locale 子标签通道（en-GB/en-US/en-AU 等 BCP-47 subtag 持久化 + normalizeLocale 归一 + DICT 回退 + cloudSync meta 携带，与 H5 同构）
// Why: CEO 周远见 — 出海是 V8.14→V9 战略支点；CTO+毒舌老王：不引重依赖，t 函数+字典够
// 法务张律放行：locale 是用户偏好非儿童身份；subtag 不引入新身份字段；本轮仅内部切换不向用户暴露
// MP wxml 不支持运行时函数调用，所以导出 dict(locale) 返回整个字典对象供 onShow 注入

const storage = require('./storage')

// 文案字典 — 160 条 key（V8.19: 6 Profile summary + 9 Discover + 15 Ask + 35 QuestionDetail + 26 Archive + 39 Profile chrome + 30 Profile streakMsg+date；NotFound 不适用 MP）
// CCO 文若水 + Global 何联合定调：'Total responses' / 'Deep dives' / 'Quick peeks' / 'Re-reads'
// 墨小暖定 IP 英文昵称：答答熊 'Buddy Bear'、问问兔 'Ask Bunny'
// 社会学刘教授：用 "you" 而非 "mommy/daddy"，包容隔代抚养/单亲/双亲
const DICT = {
  zh: {
    // --- Profile summary (V8.14) ---
    'profile.summary.aria': '累计反馈参与度汇总',
    'profile.summary.total': '累计反馈 {n} 次',
    'profile.summary.depth': '🌱 深度学习 {n} 次（L2 {a} · L3 {b}）',
    'profile.summary.preview': '👀 长按预览 {n} 次',
    'profile.summary.replay': '📖 再读 {n} 次',
    'profile.summary.empty': '还没有反馈过，下次孩子问"为什么"时给答答熊的答案点个赞吧 👍',

    // --- Discover (V8.17 Sprint 26) ---
    'discover.title': '十亿个什么与为什么',
    'discover.subtitle': '{n} 个问题等你来探索',
    'discover.loading': '问问兔正在准备问题...',
    'discover.loadError': '加载失败了，请重试',
    'discover.retry': '重新加载',
    'discover.dailyTag': '✨ 今天的为什么',
    'discover.expand': '展开更多（共 {n} 条）',
    'discover.collapse': '收起',
    'discover.empty': '这个分类的问题正在准备中',

    // --- Ask (V8.17 Sprint 26) ---
    'ask.title': '问一问',
    'ask.subtitle': '输入你想知道的问题',
    'ask.placeholder': '为什么会下雨？为什么要睡觉？',
    'ask.searchAria': '搜索问题',
    'ask.clearAria': '清除搜索',
    'ask.resultsFound': '找到 {n} 个相关问题',
    'ask.noResult': '问问兔也在学习这个问题呢！',
    'ask.suggestHint': '试试看看下面这些相关的问题',
    'ask.suggestTitle': '你可能想问',
    'ask.recentTitle': '最近搜过',
    'ask.clearHistoryAria': '清空搜索历史',
    'ask.clearHistory': '清空',
    'ask.recentSearchAria': '搜索：{term}',
    'ask.hotTitle': '大家都在问',
    'ask.hintTitle': '试试问：',

    // --- QuestionDetail (V8.17 Sprint 26) ---
    'qd.backAria': '返回上一页',
    'qd.back': '← 返回',
    'qd.age': '适合 {age}',
    'qd.favAddAria': '收藏这个问题',
    'qd.favRemoveAria': '取消收藏',
    'qd.bear': '答答熊',
    'qd.rabbit': '问问兔',
    'qd.layer1Badge': '💬 第1层 · 直接回答',
    'qd.layer2Badge': '🔄 第2层 · 继续追问',
    'qd.layer3Badge': '🌟 第3层 · 趣味延伸',
    'qd.bowAria': '问问兔在鞠躬感谢你的反馈',
    'qd.thanks': '谢谢你的反馈，我们会让问问兔更努力！',
    'qd.expAria': '试试和问问兔一起做互动实验',
    'qd.expCta': '🤲 试试互动实验',
    'qd.resetAria': '清除当前反馈，重新选择有用或没用',
    'qd.resetCta': '↻ 再评一次',
    'qd.feedbackAria': '答案反馈',
    'qd.feedbackPrompt': '这个回答对孩子有用吗？',
    'qd.usefulAria': '有用',
    'qd.useful': '👍 有用',
    'qd.uselessAria': '没用',
    'qd.useless': '👎 没用',
    'qd.layer2Cta': '问问兔还有更多发现哦 👇',
    'qd.layer2CtaShort': '继续追问 👇',
    'qd.layer3Cta': '还想知道更多 👇',
    'qd.warmClosing': '好奇心是最厉害的超能力哦！',
    'qd.relatedTitle': '相关好奇',
    'qd.navAria': '问题导航',
    'qd.prevAria': '上一个问题：{q}',
    'qd.nextAria': '下一个问题：{q}',
    'qd.errorTitle': '加载遇到问题了',
    'qd.errorHint': '点击下方按钮重试',
    'qd.retry': '重新加载',
    'qd.loadingTitle': '问问兔正在准备中…',
    'qd.loadingHint': '马上就好',

    // --- Archive (V8.18 Sprint 27) ---
    'archive.title': '📊 好奇档案',
    'archive.subtitle': '记录每一次好奇心的旅程',
    'archive.tabBarAria': '好奇档案分类',
    'archive.tabHistory': '浏览历史',
    'archive.tabFavoritesText': '收藏 ({n})',
    'archive.tabFavoritesAria': '我的收藏 {n} 条',
    'archive.tabFavoritesPanelAria': '我的收藏',
    'archive.statsAria': '探索统计',
    'archive.statViewed': '已探索',
    'archive.statToday': '今日',
    'archive.statStreak': '连续天',
    'archive.dateCount': '探索了 {n} 个问题',
    'archive.emptyHistory': '还没有探索记录',
    'archive.emptyHistorySub': '去发现页看看有什么有趣的问题吧！',
    'archive.goDiscover': '去探索',
    'archive.emptyFav': '还没有收藏',
    'archive.emptyFavSub': '在问题详情页点击星标即可收藏',
    'archive.goDiscoverFav': '去发现',
    'archive.confirmAria': '确认取消收藏',
    'archive.confirmTitle': '要取消收藏吗？',
    'archive.confirmCancel': '再想想',
    'archive.confirmOk': '取消收藏',
    'archive.toastRemoved': '已取消收藏',
    'archive.favLongPressAria': '{q}，长按可取消收藏',
    'archive.unknownQuestion': '未知问题',
    'archive.loadErrorToast': '记录加载失败',

    // --- Profile UI chrome (V8.18 Sprint 27, 隐私政策正文留 V9) ---
    'profile.title': '小探险家的好奇世界',
    'profile.statsAria': '探索统计',
    'profile.statViewed': '已探索问题',
    'profile.statToday': '今日提问',
    'profile.statStreak': '连续天数',
    'profile.statLibrary': '知识库',
    'profile.statFav': '收藏',
    'profile.statFeedback': '已反馈',
    'profile.trendAria': '过去7天反馈趋势',
    'profile.trendTitle': '过去7天反馈了 {n} 次',
    'profile.trendBarAria': '过去7天反馈了 {n} 次',
    'profile.dayAria': '{day} · 反馈 {n} 次',
    'profile.dayAriaWithDetail': '{day} · 反馈 {n} 次，点击查看明细',
    'profile.dayDetailAria': '{day} 反馈明细',
    'profile.replayAria': '再读一遍：{title}，长按可预览',
    'profile.depthAria': '读到第{n}层',
    'profile.depthText': '读到第{n}层',
    'profile.dayEmpty': '🌱 这天没有反馈明细',
    'profile.trendEmpty': '🌱 这周还没有反馈，看完一个答案试试 👍 或 👎 吧',
    'profile.menuFeedback': '💬 意见反馈',
    'profile.menuFeedbackAria': '意见反馈',
    'profile.menuAbout': '📖 关于我们',
    'profile.menuAboutAria': '关于我们',
    'profile.menuPrivacy': '🔒 隐私政策',
    'profile.menuPrivacyAria': '隐私政策',
    'profile.aboutTitle': '十亿个什么与为什么',
    'profile.aboutContent': '面向2-6岁儿童家庭的好奇心即时响应引擎',
    'profile.previewBadge': '👀 长按预览',
    'profile.previewAria': '预览：{title}',
    'profile.previewCloseAria': '关闭预览',
    'profile.previewEmpty': '这条记录暂无预览内容',
    'profile.previewReplay': '📖 再读一遍',
    'profile.previewClose': '关闭',
    'profile.archiveLinkAria': '查看好奇档案',
    'profile.archiveLink': '查看好奇档案',
    'profile.archiveStats': '已探索 {v} · 收藏 {f} · 反馈 {fb}',
    'profile.versionFooter': 'v{v} · 十亿个什么与为什么',
    'profile.feedbackLoadToast': '内容加载失败',
    'profile.dataLoadToast': '数据加载失败',

    // --- Profile streakMessage + date format (V8.19 Sprint 28 i18n 第三批) ---
    'profile.streakMsg.returning': '欢迎回来！问问兔一直在等你哦',
    'profile.streakMsg.firstTime': '你好呀！一起开始好奇心探索吧！',
    'profile.streakMsg.day30': '🏆 连续探索30天！你是超级小探险家！',
    'profile.streakMsg.day7': '🌟 连续探索一周了，好奇心满满！',
    'profile.streakMsg.day3': '✨ 连续探索3天，继续加油！',
    'profile.streakMsg.day1': '🌱 今天也来探索了，真棒！',
    'profile.weekday.0': '日',
    'profile.weekday.1': '一',
    'profile.weekday.2': '二',
    'profile.weekday.3': '三',
    'profile.weekday.4': '四',
    'profile.weekday.5': '五',
    'profile.weekday.6': '六',
    'profile.monthShort.0': '1',
    'profile.monthShort.1': '2',
    'profile.monthShort.2': '3',
    'profile.monthShort.3': '4',
    'profile.monthShort.4': '5',
    'profile.monthShort.5': '6',
    'profile.monthShort.6': '7',
    'profile.monthShort.7': '8',
    'profile.monthShort.8': '9',
    'profile.monthShort.9': '10',
    'profile.monthShort.10': '11',
    'profile.monthShort.11': '12',
    'profile.dayLabel.today': '今天',
    'profile.dayLabel.yesterday': '昨天',
    'profile.detailHeaderFormat': '{month} 月 {date} 日 周{weekday} · {parts}',
    'profile.detailNoFeedback': '无反馈',
    'profile.detailResetCount': '再评 {n}',

    // --- Profile 隐私政策 + 用户协议 正文 (V8.23 Sprint 32 法务专项，与 H5 同构) ---
    // Why: V8.18 法务张律一票否决 "隐私政策正文不与 UI chrome 同批翻译"，本轮 V9 出海前置法务专项收口
    // 法务张律: 起草英文版，严守 COPPA / GDPR-K / 《儿童个人信息网络保护规定》三重合规口径
    // 心理学家周教授: 正文给家长看，非儿童；en 用 "you/your child" 包容隔代抚养/单亲/双亲
    // CCO 文若水: zh→en 不直译，"零数据收集" 译 "Zero data collection" 而非 "zero data collected"
    // 安全李姐: 不出现 "_tracking_" "profile_" 等可能引起家长焦虑的术语，用 "no ad tracking" 直白表述
    // 毒舌老王: H5 与 MP 正文统一为同一份 i18n key，避免双端文案分叉
    'profile.privacy.title': '隐私政策',
    'profile.privacy.intro': '本应用严格遵守《儿童个人信息网络保护规定》，承诺如下：',
    'profile.privacy.zeroCollection.label': '零数据收集',
    'profile.privacy.zeroCollection.body': '不收集任何儿童或家长的个人信息（包括姓名、照片、位置等）。',
    'profile.privacy.localStorage.label': '本地存储',
    'profile.privacy.localStorage.body': '浏览记录仅以匿名形式存储在您设备本地，不会上传至任何服务器。',
    'profile.privacy.noSharing.label': '无第三方共享',
    'profile.privacy.noSharing.body': '不向任何第三方传输、共享或出售用户数据。',
    'profile.privacy.noAds.label': '无广告追踪',
    'profile.privacy.noAds.body': '不使用任何广告追踪或用户画像技术。',
    'profile.privacy.localStats.label': '本地统计',
    'profile.privacy.localStats.body': '仅在设备本地记录匿名页面访问次数与反馈行动次数（👍/👎/↻ 重置），不会上传至任何服务器。',
    'profile.agreement.title': '用户协议',
    'profile.agreement.disclaimer': '本应用提供的科普内容经过专业审核，但仅供参考和亲子互动使用，不构成医学或专业建议。所有互动实验请在大人陪伴下进行。',
    'profile.agreement.contact': '如有任何问题，请通过下方"意见反馈"联系我们。',

    // --- MP 隐私页 chrome (V8.23 Sprint 32 法务专项) ---
    // 毒舌老王: MP 隐私页是独立路由 page，需独立 chrome keys (back/version/footer)，正文复用 profile.privacy.* / profile.agreement.*
    'privacy.back': '← 返回',
    'privacy.versionLine': '版本：v{v} | 更新日期：{d}',
    'privacy.footer': '十亿个什么与为什么 | 守护每个孩子的好奇心',
  },
  en: {
    // --- Profile summary (V8.14) ---
    'profile.summary.aria': 'Total response summary',
    'profile.summary.total': '{n} total responses',
    'profile.summary.depth': '🌱 {n} deep dives (L2 {a} · L3 {b})',
    'profile.summary.preview': '👀 {n} quick peeks',
    'profile.summary.replay': '📖 {n} re-reads',
    'profile.summary.empty': 'No responses yet — next time your child asks "why", give Buddy Bear\'s answer a thumbs-up 👍',

    // --- Discover (V8.17 Sprint 26) ---
    'discover.title': 'A Billion Whys',
    'discover.subtitle': '{n} questions to explore',
    'discover.loading': 'Ask Bunny is getting questions ready...',
    'discover.loadError': 'Failed to load, please retry',
    'discover.retry': 'Retry',
    'discover.dailyTag': "✨ Today's Why",
    'discover.expand': 'Show more ({n} in total)',
    'discover.collapse': 'Collapse',
    'discover.empty': 'Questions in this category are coming soon',

    // --- Ask (V8.17 Sprint 26) ---
    'ask.title': 'Ask',
    'ask.subtitle': 'Type a question you wonder about',
    'ask.placeholder': 'Why does it rain? Why do we sleep?',
    'ask.searchAria': 'Search questions',
    'ask.clearAria': 'Clear search',
    'ask.resultsFound': '{n} related questions found',
    'ask.noResult': 'Ask Bunny is still learning this one!',
    'ask.suggestHint': 'Try these related questions',
    'ask.suggestTitle': 'You might wonder',
    'ask.recentTitle': 'Recent searches',
    'ask.clearHistoryAria': 'Clear search history',
    'ask.clearHistory': 'Clear',
    'ask.recentSearchAria': 'Search: {term}',
    'ask.hotTitle': 'Popular questions',
    'ask.hintTitle': 'Try asking:',

    // --- QuestionDetail (V8.17 Sprint 26) ---
    'qd.backAria': 'Back to previous page',
    'qd.back': '← Back',
    'qd.age': 'Ages {age}',
    'qd.favAddAria': 'Save this question',
    'qd.favRemoveAria': 'Unsave',
    'qd.bear': 'Buddy Bear',
    'qd.rabbit': 'Ask Bunny',
    'qd.layer1Badge': '💬 Layer 1 · Direct answer',
    'qd.layer2Badge': '🔄 Layer 2 · Dig deeper',
    'qd.layer3Badge': '🌟 Layer 3 · Fun extra',
    'qd.bowAria': 'Ask Bunny is bowing to thank you for the feedback',
    'qd.thanks': 'Thanks for the feedback — Ask Bunny will work even harder!',
    'qd.expAria': 'Try a hands-on experiment with Ask Bunny',
    'qd.expCta': '🤲 Try a hands-on experiment',
    'qd.resetAria': 'Clear current feedback and pick helpful / not helpful again',
    'qd.resetCta': '↻ Rate again',
    'qd.feedbackAria': 'Answer feedback',
    'qd.feedbackPrompt': 'Was this answer helpful?',
    'qd.usefulAria': 'Helpful',
    'qd.useful': '👍 Helpful',
    'qd.uselessAria': 'Not helpful',
    'qd.useless': '👎 Not helpful',
    'qd.layer2Cta': 'Ask Bunny has more to share 👇',
    'qd.layer2CtaShort': 'Dig deeper 👇',
    'qd.layer3Cta': 'Want to know more 👇',
    'qd.warmClosing': 'Curiosity is the best superpower!',
    'qd.relatedTitle': 'Related whys',
    'qd.navAria': 'Question navigation',
    'qd.prevAria': 'Previous question: {q}',
    'qd.nextAria': 'Next question: {q}',
    'qd.errorTitle': 'Something went wrong',
    'qd.errorHint': 'Tap the button below to retry',
    'qd.retry': 'Retry',
    'qd.loadingTitle': 'Ask Bunny is getting ready…',
    'qd.loadingHint': 'Just a moment',

    // --- Archive (V8.18 Sprint 27) ---
    'archive.title': '📊 Curiosity Archive',
    'archive.subtitle': "Every spark of curiosity, recorded",
    'archive.tabBarAria': 'Archive tabs',
    'archive.tabHistory': 'Browsing history',
    'archive.tabFavoritesText': 'Saved ({n})',
    'archive.tabFavoritesAria': 'Saved: {n} items',
    'archive.tabFavoritesPanelAria': 'My saves',
    'archive.statsAria': 'Exploration stats',
    'archive.statViewed': 'Explored',
    'archive.statToday': 'Today',
    'archive.statStreak': 'Day streak',
    'archive.dateCount': 'Explored {n} questions',
    'archive.emptyHistory': 'No explorations yet',
    'archive.emptyHistorySub': 'Try the Discover page for fun questions!',
    'archive.goDiscover': 'Explore',
    'archive.emptyFav': 'No saves yet',
    'archive.emptyFavSub': 'Tap the star on a question to save it',
    'archive.goDiscoverFav': 'Discover',
    'archive.confirmAria': 'Confirm unsave',
    'archive.confirmTitle': 'Unsave this question?',
    'archive.confirmCancel': 'Keep it',
    'archive.confirmOk': 'Unsave',
    'archive.toastRemoved': 'Unsaved',
    'archive.favLongPressAria': '{q} — long-press to unsave',
    'archive.unknownQuestion': 'Unknown question',
    'archive.loadErrorToast': 'Failed to load records',

    // --- Profile UI chrome (V8.18 Sprint 27, privacy body deferred to V9) ---
    'profile.title': "Little explorer's curiosity world",
    'profile.statsAria': 'Exploration stats',
    'profile.statViewed': 'Questions explored',
    'profile.statToday': "Today's questions",
    'profile.statStreak': 'Day streak',
    'profile.statLibrary': 'Library',
    'profile.statFav': 'Saved',
    'profile.statFeedback': 'Feedback',
    'profile.trendAria': 'Past 7-day feedback trend',
    'profile.trendTitle': '{n} feedback actions in the past 7 days',
    'profile.trendBarAria': '{n} feedback actions in the past 7 days',
    'profile.dayAria': '{day} · {n} feedback',
    'profile.dayAriaWithDetail': '{day} · {n} feedback — tap for details',
    'profile.dayDetailAria': '{day} feedback detail',
    'profile.replayAria': 'Read again: {title} — long-press to preview',
    'profile.depthAria': 'Reached layer {n}',
    'profile.depthText': 'Reached layer {n}',
    'profile.dayEmpty': '🌱 No feedback detail for this day',
    'profile.trendEmpty': '🌱 No feedback this week — try 👍 or 👎 after an answer',
    'profile.menuFeedback': '💬 Feedback',
    'profile.menuFeedbackAria': 'Feedback',
    'profile.menuAbout': '📖 About us',
    'profile.menuAboutAria': 'About us',
    'profile.menuPrivacy': '🔒 Privacy policy',
    'profile.menuPrivacyAria': 'Privacy policy',
    'profile.aboutTitle': 'A Billion Whys',
    'profile.aboutContent': 'A curiosity instant-response engine for families with kids aged 2-6',
    'profile.previewBadge': '👀 Long-press preview',
    'profile.previewAria': 'Preview: {title}',
    'profile.previewCloseAria': 'Close preview',
    'profile.previewEmpty': 'No preview for this entry',
    'profile.previewReplay': '📖 Read again',
    'profile.previewClose': 'Close',
    'profile.archiveLinkAria': 'View curiosity archive',
    'profile.archiveLink': 'View archive',
    'profile.archiveStats': 'Explored {v} · Saved {f} · Feedback {fb}',
    'profile.versionFooter': 'v{v} · A Billion Whys',
    'profile.feedbackLoadToast': 'Failed to load content',
    'profile.dataLoadToast': 'Failed to load data',

    // --- Profile streakMessage + date format (V8.19 Sprint 28 i18n batch 3) ---
    'profile.streakMsg.returning': 'Welcome back! Ask Bunny missed you.',
    'profile.streakMsg.firstTime': "Hi there! Let's start exploring!",
    'profile.streakMsg.day30': "🏆 30 days in a row! You're a super explorer!",
    'profile.streakMsg.day7': '🌟 A whole week of exploring!',
    'profile.streakMsg.day3': '✨ 3 days in a row! Keep it up!',
    'profile.streakMsg.day1': '🌱 Explored today! Great job!',
    'profile.weekday.0': 'Sun',
    'profile.weekday.1': 'Mon',
    'profile.weekday.2': 'Tue',
    'profile.weekday.3': 'Wed',
    'profile.weekday.4': 'Thu',
    'profile.weekday.5': 'Fri',
    'profile.weekday.6': 'Sat',
    'profile.monthShort.0': 'Jan',
    'profile.monthShort.1': 'Feb',
    'profile.monthShort.2': 'Mar',
    'profile.monthShort.3': 'Apr',
    'profile.monthShort.4': 'May',
    'profile.monthShort.5': 'Jun',
    'profile.monthShort.6': 'Jul',
    'profile.monthShort.7': 'Aug',
    'profile.monthShort.8': 'Sep',
    'profile.monthShort.9': 'Oct',
    'profile.monthShort.10': 'Nov',
    'profile.monthShort.11': 'Dec',
    'profile.dayLabel.today': 'Today',
    'profile.dayLabel.yesterday': 'Yesterday',
    'profile.detailHeaderFormat': '{weekday}, {month} {date} · {parts}',
    'profile.detailNoFeedback': 'No feedback',
    'profile.detailResetCount': 'Re-rate {n}',

    // --- Profile Privacy Policy + User Agreement body (V8.23 Sprint 32 legal batch, H5 parity) ---
    // 法务张律: English version strictly aligns with COPPA / GDPR-K / PRC Regulations on Protection of Children's Personal Information Online
    // 心理学家周教授: en uses "you / your child" — inclusive of single-parent / grandparent caregivers
    // CCO 文若水: translate intent, not literally — "零数据收集" → "Zero data collection"
    // 安全李姐: avoid anxiety-triggering jargon; plain-language "no ad tracking"
    'profile.privacy.title': 'Privacy Policy',
    'profile.privacy.intro': 'This app strictly complies with the Regulations on the Protection of Children\'s Personal Information Online. Our commitments:',
    'profile.privacy.zeroCollection.label': 'Zero data collection',
    'profile.privacy.zeroCollection.body': 'We collect no personal information from children or caregivers (including names, photos, location, etc.).',
    'profile.privacy.localStorage.label': 'Local storage',
    'profile.privacy.localStorage.body': 'Browsing history is stored anonymously on your device only, never uploaded to any server.',
    'profile.privacy.noSharing.label': 'No third-party sharing',
    'profile.privacy.noSharing.body': 'We never transmit, share, or sell user data to any third party.',
    'profile.privacy.noAds.label': 'No ad tracking',
    'profile.privacy.noAds.body': 'We use no ad tracking or user profiling technologies.',
    'profile.privacy.localStats.label': 'Local stats',
    'profile.privacy.localStats.body': 'We only record anonymous page-view counts and feedback action counts (👍/👎/↻ reset) locally on your device, never uploaded to any server.',
    'profile.agreement.title': 'User Agreement',
    'profile.agreement.disclaimer': 'All science content in this app is professionally reviewed, but is for reference and parent-child interaction only, and does not constitute medical or professional advice. All hands-on experiments must be done with adult supervision.',
    'profile.agreement.contact': 'For any questions, please contact us via "Feedback" below.',

    // --- MP privacy page chrome (V8.23 Sprint 32 legal batch) ---
    'privacy.back': '← Back',
    'privacy.versionLine': 'Version: v{v} | Updated: {d}',
    'privacy.footer': 'A Billion Whys | Guarding every child\'s curiosity',
  },
  // V8.21 Sprint 30: en-GB 子分支 hook 占位（与 H5 同构；V9 出海文案专项时直接注入 spelling 分叉）
  'en-GB': {},
}

// V8.21 Sprint 30: normalizeLocale — BCP-47 子标签归一（与 H5 src/h5/utils/i18n.js 同构）
// Why: Global 何 — 出海首站英联邦家庭默认 en-GB；前端小凡 — getLocale 保留 subtag 供未来格式化
// 法务张律：subtag 不引入新身份字段；CEO 裁决：未知 subtag 归一 zh（与 V8.14 默认 locale 一致）
const SUPPORTED_BASES = ['zh', 'en']

function normalizeLocale(locale) {
  if (!locale || typeof locale !== 'string') return 'zh'
  const base = locale.toLowerCase().split('-')[0]
  return SUPPORTED_BASES.indexOf(base) >= 0 ? base : 'zh'
}

function getLocale() {
  return storage.getLocale()
}

function setLocale(locale) {
  return storage.setLocale(locale)
}

// t(key, params?, locale?) — 未知 key 安全返回 key 本身；{n} 风格插值
// V8.21 Sprint 30: locale 子标签查表顺序 subtag → base → zh（与 H5 同构）
function t(key, params, locale) {
  const raw = locale || getLocale()
  const base = normalizeLocale(raw)
  const subtag = raw && raw !== base ? raw : null
  let s
  if (subtag && DICT[subtag] && DICT[subtag][key] !== undefined) {
    s = DICT[subtag][key]
  } else if (DICT[base] && DICT[base][key] !== undefined) {
    s = DICT[base][key]
  } else if (DICT.zh[key] !== undefined) {
    s = DICT.zh[key]
  } else {
    return key
  }
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]))
    }
  }
  return s
}

// dict(locale?) — 返回整个字典对象（MP wxml 不支持函数调用，需 onShow 注入整字典）
// V8.21 Sprint 30: subtag 字典为空时回退到 base 字典（与 t() 查表顺序一致）
// 用法：profile.js onShow setData({ t: i18n.dict(this.data.locale) })
function dict(locale) {
  const raw = locale || getLocale()
  const base = normalizeLocale(raw)
  if (raw && raw !== base && DICT[raw] && Object.keys(DICT[raw]).length > 0) {
    return DICT[raw]
  }
  return DICT[base] || DICT.zh
}

module.exports = {
  DICT,
  normalizeLocale,
  getLocale,
  setLocale,
  t,
  dict,
}
