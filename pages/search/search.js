// pages/search/search.js
const app = getApp();
const { processArchive } = require('../../utils/util');

Page({
  data: {
    keyword: '',
    resultList: [],
    searched: false,
    loading: false,
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
    if (!e.detail.value.trim()) {
      this.setData({ searched: false, resultList: [] });
    }
  },

  onSearch() {
    const { keyword } = this.data;
    if (!keyword.trim()) return;

    this.setData({ loading: true });

    app.request({
      url: '/archives/search',
      data: { keyword: keyword.trim(), page: 1, pageSize: 20 },
      success: (res) => {
        this.setData({
          resultList: (res.data.list || []).map(processArchive),
          searched: true,
          loading: false,
        });
      },
      fail: () => {
        this.setData({ resultList: [], searched: true, loading: false });
      },
    });
  },

  onClear() {
    this.setData({ keyword: '', searched: false, resultList: [] });
  },

  onCardTap(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },
});
