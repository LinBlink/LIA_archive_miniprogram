// pages/my-collects/my-collects.js
const app = getApp();
const { processArchive } = require('../../utils/util');

const PAGE_SIZE = 15;

Page({
  data: {
    archiveList: [],
    loading: true,
    hasMore: true,
    page: 1,
  },

  onLoad() {
    if (!app.requireLogin()) return;
    this.loadMyCollects(true);
  },

  loadMyCollects(reset = false) {
    if (reset) {
      this.setData({ page: 1, archiveList: [], hasMore: true });
    }
    if (!this.data.hasMore && !reset) return;

    this.setData({ loading: reset });

    app.request({
      url: '/user/collects',
      data: { page: this.data.page, pageSize: PAGE_SIZE },
      success: (res) => {
        const rawList = res.data.list || [];
        const processed = rawList.map(processArchive);
        const newList = reset ? processed : [...this.data.archiveList, ...processed];
        this.setData({
          archiveList: newList,
          hasMore: rawList.length === PAGE_SIZE,
          loading: false,
        });
      },
      fail: () => {
        this.setData({ loading: false });
      },
    });
  },

  onCardTap(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  onUncollectTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消收藏',
      content: '确定要取消对这条档案的收藏吗？',
      confirmText: '取消收藏',
      confirmColor: '#C8392B',
      success: (res) => {
        if (!res.confirm) return;
        app.request({
          url: `/user/collects/${id}`,
          method: 'DELETE',
          success: () => {
            wx.showToast({ title: '已取消收藏', icon: 'none' });
            this.loadMyCollects(true);
          },
        });
      },
    });
  },

  onReachBottom() {
    if (!this.data.hasMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadMyCollects(false);
  },

  onPullDownRefresh() {
    this.loadMyCollects(true);
    wx.stopPullDownRefresh();
  },
});
