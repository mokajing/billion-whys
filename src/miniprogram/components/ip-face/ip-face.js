Component({
  properties: {
    role: {
      type: String,
      value: 'rabbit',
    },
    size: {
      type: Number,
      value: 32,
    },
    // V8.0 第69轮：mood='bowing' 触发鞠躬动效（仅问问兔生效；答答熊保留默认）
    mood: {
      type: String,
      value: 'default',
    },
  },
})
