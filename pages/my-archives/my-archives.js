// pages/my-archives/my-archives.js
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
    this.loadMyArchives(true);
  },

  onShow() {
    if (!app.isLoggedIn()) return;
    if (app.globalData.contentUpdated) {
      this.loadMyArchives(true);
    }
  },

  loadMyArchives(reset = false) {
    if (reset) {
      this.setData({ page: 1, archiveList: [], hasMore: true });
    }
    if (!this.data.hasMore && !reset) return;

    this.setData({ loading: reset });

    app.request({
      url: '/user/archives',
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

  onDeleteTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条档案吗？',
      confirmText: '删除',
      confirmColor: '#C8392B',
      success: (res) => {
        if (!res.confirm) return;
        app.request({
          url: `/archives/${id}`,
          method: 'DELETE',
          success: () => {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadMyArchives(true);
          },
        });
      },
    });
  },

  onReachBottom() {
    if (!this.data.hasMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadMyArchives(false);
  },

  onPullDownRefresh() {
    this.loadMyArchives(true);
    wx.stopPullDownRefresh();
  },
});
