// pages/search/search.js
const app = getApp();
const { processArchive } = require('../../utils/util');

Page({
  data: {
    keyword: '',
    resultList: [],
    searched: false,
    hotTags: ['集体失忆', '不明光源', '异常声响', '时间异常', '人员失踪', '幻视', '幻听', '动物异常', '机械故障', '温度异常'],
    regions: [
      { name: '广东省', count: 12 },
      { name: '四川省', count: 8 },
      { name: '福建省', count: 6 },
      { name: '浙江省', count: 5 },
      { name: '北京市', count: 4 },
      { name: '云南省', count: 3 },
    ],
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    const { keyword } = this.data;
    if (!keyword.trim()) return;

    app.request({
      url: '/archives/search',
      data: { keyword, page: 1, pageSize: 20 },
      success: (res) => {
        this.setData({
          resultList: (res.data.list || []).map(processArchive),
          searched: true,
        });
      },
      fail: () => {
        // mock 结果
        this.setData({
          resultList: [],
          searched: true,
        });
      }
    });
  },

  onClear() {
    this.setData({ keyword: '', searched: false, resultList: [] });
  },

  onTagTap(e) {
    this.setData({ keyword: e.currentTarget.dataset.tag });
    this.onSearch();
  },

  onRegionTap(e) {
    this.setData({ keyword: e.currentTarget.dataset.region });
    this.onSearch();
  },

  onCardTap(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },
});
