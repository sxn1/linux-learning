const db = require('../../utils/db')
const { categories } = require('../../data/mock')

Page({
  data: {
    keyword: '',
    results: [],
    searched: false,
    loading: false,
    catMap: {},  // categoryId → name
  },

  onLoad() {
    const catMap = {}
    categories.forEach(c => { catMap[c._id] = c.name })
    this.setData({ catMap })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    const kw = this.data.keyword.trim()
    if (!kw) return
    this.setData({ loading: true })
    db.search(kw).then(results => {
      const enriched = results.map(k => ({
        ...k,
        catName: this.data.catMap[k.categoryId] || k.categoryId,
      }))
      this.setData({ results: enriched, searched: true, loading: false })
    })
  },

  clearKeyword() {
    this.setData({ keyword: '', results: [], searched: false })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },
})
