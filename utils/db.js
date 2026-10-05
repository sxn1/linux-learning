// 数据库封装：优先云数据库，降级到本地 Mock 数据
const mock = require('../data/mock')

const USE_CLOUD = false  // 开通云开发后改为 true

const db = {
  // 获取所有分类
  async getCategories() {
    if (!USE_CLOUD) return mock.categories
    const res = await wx.cloud.database().collection('categories')
      .orderBy('order', 'asc').get()
    return res.data
  },

  // 获取某分类下的知识点列表
  async getKnowledgeList(categoryId, difficulty) {
    if (!USE_CLOUD) {
      let list = mock.knowledge.filter(k => k.categoryId === categoryId)
      if (difficulty) list = list.filter(k => k.difficulty === difficulty)
      return list
    }
    let query = wx.cloud.database().collection('knowledge')
      .where({ categoryId })
    if (difficulty) query = query.where({ difficulty })
    const res = await query.orderBy('createdAt', 'desc').get()
    return res.data
  },

  // 获取知识点详情
  async getKnowledgeDetail(id) {
    if (!USE_CLOUD) return mock.knowledge.find(k => k._id === id)
    const res = await wx.cloud.database().collection('knowledge').doc(id).get()
    return res.data
  },

  // 全文搜索（本地 mock 下简单 filter）
  async search(keyword) {
    if (!USE_CLOUD) {
      const kw = keyword.toLowerCase()
      return mock.knowledge.filter(k =>
        k.title.toLowerCase().includes(kw) ||
        k.summary.toLowerCase().includes(kw) ||
        k.tags.some(t => t.toLowerCase().includes(kw)) ||
        k.interviews.some(i => i.question.toLowerCase().includes(kw))
      )
    }
    // 云数据库支持正则搜索
    const _ = wx.cloud.database().command
    const res = await wx.cloud.database().collection('knowledge')
      .where(_.or([
        { title: wx.cloud.database().RegExp({ regexp: keyword, options: 'i' }) },
        { summary: wx.cloud.database().RegExp({ regexp: keyword, options: 'i' }) },
      ])).get()
    return res.data
  },

  // 新增知识点（需开通云开发）
  async addKnowledge(data) {
    if (!USE_CLOUD) {
      console.warn('云开发未开通，无法保存')
      return
    }
    return wx.cloud.database().collection('knowledge').add({ data })
  }
}

module.exports = db
