const db = require('../../utils/db')

const DIFFICULTY_LABEL = { 1: '入门', 2: '进阶', 3: '专家' }
const DIFFICULTY_COLOR = { 1: '#388e3c', 2: '#f57c00', 3: '#c62828' }

Page({
  data: {
    categoryId: '',
    categoryName: '',
    list: [],
    filtered: [],
    difficulty: 0,   // 0 = 全部
    loading: true,
  },

  async onLoad(options) {
    const { categoryId, name } = options
    wx.setNavigationBarTitle({ title: name })
    this.setData({ categoryId, categoryName: name })
    const list = await db.getKnowledgeList(categoryId)
    const enriched = list.map(k => ({
      ...k,
      difficultyLabel: DIFFICULTY_LABEL[k.difficulty] || '',
      difficultyColor: DIFFICULTY_COLOR[k.difficulty] || '#333',
    }))
    this.setData({ list: enriched, filtered: enriched, loading: false })
  },

  filterByDifficulty(e) {
    const d = Number(e.currentTarget.dataset.d)
    const difficulty = d === this.data.difficulty ? 0 : d
    const filtered = difficulty === 0
      ? this.data.list
      : this.data.list.filter(k => k.difficulty === difficulty)
    this.setData({ difficulty, filtered })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },
})
