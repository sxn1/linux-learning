const db = require('../../utils/db')

const LEVEL_LABEL = { basic: '基础', advanced: '进阶', expert: '专家' }

Page({
  data: {
    item: null,
    // 折叠状态
    showConcept: true,
    showPrinciple: true,
    showCase: true,
    // 每道面试题的答案展开状态
    openAnswers: {},
  },

  async onLoad(options) {
    const item = await db.getKnowledgeDetail(options.id)
    if (!item) return
    wx.setNavigationBarTitle({ title: item.title })
    const interviews = item.interviews.map((q, i) => ({
      ...q,
      index: i,
      levelLabel: LEVEL_LABEL[q.level] || q.level,
    }))
    this.setData({ item: { ...item, interviews } })
  },

  toggleSection(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: !this.data[key] })
  },

  toggleAnswer(e) {
    const { idx } = e.currentTarget.dataset
    const key = `openAnswers.${idx}`
    this.setData({ [key]: !this.data.openAnswers[idx] })
  },
})
