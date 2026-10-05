const db = require('../../utils/db')

Page({
  data: {
    categories: [],
    loading: true,
  },

  async onLoad() {
    const categories = await db.getCategories()
    // 给每个分类补充知识点数量
    const all = require('../../data/mock').knowledge
    const withCount = categories.map(c => ({
      ...c,
      count: all.filter(k => k.categoryId === c._id).length
    }))
    this.setData({ categories: withCount, loading: false })
  },

  goList(e) {
    const { id, name } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/list/list?categoryId=${id}&name=${name}` })
  },

  goSearch() {
    wx.switchTab({ url: '/pages/search/search' })
  },
})
