// pages/login/login.js
const app = getApp();

Page({
  data: {
    loading: false,
    activeTab: 'phone',
    phoneMode: 'login',
    phone: '',
    password: '',
    nickName: '',
  },

  onLoad() {
    if (app.isLoggedIn()) {
      this.goBack();
    }
  },

  onTabSwitch(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  onPhoneModeSwitch(e) {
    this.setData({ phoneMode: e.currentTarget.dataset.mode });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  onPhoneSubmit() {
    const { phone, password, nickName, phoneMode, loading } = this.data;
    if (loading) return;

    if (!phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (password.length < 6) {
      wx.showToast({ title: '密码至少需要6位', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    if (phoneMode === 'login') {
      app.phoneLogin(phone, password, (err, user) => {
        this.setData({ loading: false });
        if (err) return;
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => this.goBack(), 800);
      });
    } else {
      app.phoneRegister(phone, password, nickName, (err, user) => {
        this.setData({ loading: false });
        if (err) return;
        wx.showToast({ title: '注册成功', icon: 'success' });
        setTimeout(() => this.goBack(), 800);
      });
    }
  },

  onWxLoginTap() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    app.wxLogin((err, user) => {
      this.setData({ loading: false });
      if (err) return;
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => this.goBack(), 800);
    });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },
});
