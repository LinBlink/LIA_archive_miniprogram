// pages/profile/profile.js
Page({
  data: {
    userInfo: {},
    userLevel: 1,
    uidStr: 'ANON-00000',
    myArchiveCount: 0,
    myCollectCount: 0,
    totalViews: 0,
  },

  onLoad() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    // 实际项目中从服务端获取
    this.setData({
      userInfo: { nickName: '匿名调查员' },
      userLevel: 3,
      uidStr: 'ARC-00042',
      myArchiveCount: 7,
      myCollectCount: 23,
      totalViews: 1840,
    });
  },

  onMyArchives() {
    wx.navigateTo({ url: '/pages/my-archives/my-archives' });
  },

  onMyCollects() {
    wx.navigateTo({ url: '/pages/my-collects/my-collects' });
  },

  onMyDraft() {
    wx.showToast({ title: '草稿箱开发中', icon: 'none' });
  },

  onAbout() {
    wx.showModal({
      title: '关于閾界档案馆',
      content: '閾界档案馆致力于收录和整理各类未经完整解释的异常事件档案。所有内容来自用户投稿，仅供研究与记录之用。',
      showCancel: false,
      confirmText: '了解',
      confirmColor: '#C8392B',
    });
  },

  onFeedback() {
    wx.showToast({ title: '反馈功能开发中', icon: 'none' });
  },
});
