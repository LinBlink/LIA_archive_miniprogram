// pages/profile/profile.js
const app = getApp();

const LEVEL_LABELS = ['', '档案研究员', '高级研究员', '首席调查官', '档案室长'];
const LANG_OPTIONS = [
  { label: '全部语言', value: -1 },
  { label: '仅中文', value: 0 },
  { label: 'English Only', value: 1 },
];

const NAV_DELAY_OPTIONS = [
  { label: '0.5 秒', value: 500 },
  { label: '1 秒',   value: 1000 },
  { label: '2 秒',   value: 2000 },
  { label: '3 秒',   value: 3000 },
  { label: '5 秒',   value: 5000 },
  { label: '不隐藏', value: 0 },
];

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    userLevel: 1,
    levelLabel: '访客',
    myArchiveCount: 0,
    myCollectCount: 0,
    totalViews: 0,
    // 语言偏好
    langFilter: -1,
    langOptions: LANG_OPTIONS,
    langIndex: 0,
    // 章节索引隐藏延迟
    navDelayOptions: NAV_DELAY_OPTIONS,
    navDelayIndex: 1,
    // 编辑资料
    editMode: false,
    editNickName: '',
    editSaving: false,
  },

  onLoad() {
    this.refreshState();
  },

  onShow() {
    this.refreshState();
  },

  refreshState() {
    const isLoggedIn = app.isLoggedIn();
    this.setData({ isLoggedIn });
    if (isLoggedIn) {
      this.loadUserInfo();
    }
    // 同步语言偏好
    const langFilter = app.globalData.langFilter !== undefined ? app.globalData.langFilter : -1;
    const langIndex = LANG_OPTIONS.findIndex((o) => o.value === langFilter);
    // 同步章节索引延迟
    const navDelay = app.globalData.navDelay !== undefined ? app.globalData.navDelay : 2000;
    const navDelayIndex = NAV_DELAY_OPTIONS.findIndex((o) => o.value === navDelay);
    this.setData({
      langFilter,
      langIndex: langIndex >= 0 ? langIndex : 0,
      navDelayIndex: navDelayIndex >= 0 ? navDelayIndex : 2,
    });
  },

  loadUserInfo() {
    // 先从本地缓存显示
    const cached = app.globalData.userInfo;
    if (cached) {
      this.applyUserData(cached);
    }
    // 再从服务端拉取最新数据
    app.request({
      url: '/user/profile',
      success: (res) => {
        const user = res.data;
        app.globalData.userInfo = user;
        this.applyUserData(user);
      },
      fail: () => {
        if (cached) this.applyUserData(cached);
      },
    });
  },

  applyUserData(user) {
    const level = user.level || 1;
    this.setData({
      userInfo: user,
      userLevel: level,
      levelLabel: LEVEL_LABELS[level] || '档案研究员',
      myArchiveCount: user.archive_count || 0,
      myCollectCount: user.collect_count || 0,
      totalViews: user.total_views || 0,
    });
  },

  // ── 编辑资料 ──────────────────────────────────────

  onEditProfile() {
    const { userInfo } = this.data;
    this.setData({
      editMode: true,
      editNickName: userInfo ? (userInfo.nick_name || '') : '',
    });
  },

  onEditNickNameInput(e) {
    this.setData({ editNickName: e.detail.value });
  },

  onCancelEdit() {
    this.setData({ editMode: false });
  },

  onSaveProfile() {
    const { editNickName, editSaving } = this.data;
    if (editSaving) return;
    const nick = editNickName.trim();
    if (!nick) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (nick.length > 20) {
      wx.showToast({ title: '昵称最多20个字符', icon: 'none' });
      return;
    }
    this.setData({ editSaving: true });
    app.request({
      url: '/user/profile',
      method: 'PATCH',
      data: { nick_name: nick },
      success: (res) => {
        const updated = { ...app.globalData.userInfo, nick_name: nick };
        app.globalData.userInfo = updated;
        this.setData({ editSaving: false, editMode: false });
        this.applyUserData(updated);
        wx.showToast({ title: '昵称已更新', icon: 'success' });
      },
      fail: () => {
        this.setData({ editSaving: false });
      },
    });
  },

  // ── 登录/登出 ──────────────────────────────────────

  onLoginTap() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onLogoutTap() {
    wx.showModal({
      title: '确认登出',
      content: '登出后将无法使用投稿、收藏等功能',
      confirmText: '登出',
      confirmColor: '#C8392B',
      success: (res) => {
        if (!res.confirm) return;
        app.logout();
        this.setData({
          isLoggedIn: false,
          userInfo: null,
          myArchiveCount: 0,
          myCollectCount: 0,
          totalViews: 0,
        });
        wx.showToast({ title: '已登出', icon: 'none' });
      },
    });
  },

  // ── 语言偏好 ──────────────────────────────────────

  onNavDelayChange(e) {
    const index = parseInt(e.detail.value);
    const opt = NAV_DELAY_OPTIONS[index];
    this.setData({ navDelayIndex: index });
    app.setNavDelay(opt.value);
    wx.showToast({ title: '设置已保存', icon: 'none' });
  },

  onLangChange(e) {
    const index = parseInt(e.detail.value);
    const opt = LANG_OPTIONS[index];
    this.setData({ langIndex: index, langFilter: opt.value });
    app.setLangFilter(opt.value);
    wx.showToast({ title: '语言偏好已保存', icon: 'none' });
  },

  // ── 导航 ─────────────────────────────────────────

  onMyArchives() {
    if (!app.requireLogin()) return;
    wx.navigateTo({ url: '/pages/my-archives/my-archives' });
  },

  onMyCollects() {
    if (!app.requireLogin()) return;
    wx.navigateTo({ url: '/pages/my-collects/my-collects' });
  },

  onMyDraft() {
    if (!app.requireLogin()) return;
    wx.navigateTo({ url: '/pages/drafts/drafts' });
  },

  onAbout() {
    wx.showModal({
      title: '关于閾界档案室',
      content: '閾界档案室致力于收录和整理各类未经完整解释的异常事件档案。所有内容来自用户投稿，仅供研究与记录之用。',
      showCancel: false,
      confirmText: '了解',
      confirmColor: '#C8392B',
    });
  },

  onFeedback() {
    wx.navigateTo({ url: '/pages/create/create' });
  },
});
