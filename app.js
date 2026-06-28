// app.js - 閾界档案室 全局入口
App({
  globalData: {
    userInfo: null,
    baseUrl: 'https://yjsws.cn/api',
    // baseUrl: 'https://liminality.asia/api',
    // baseUrl: 'http://192.168.2.114:10891',
    token: '',
    langFilter: -1, // -1=全部, 0=中文, 1=English
    navDelay: 2000, // 章节索引自动隐藏延迟（ms），0=不隐藏
  },

  onLaunch() {
    const token = wx.getStorageSync('lia_token');
    const userInfo = wx.getStorageSync('lia_user');
    const langFilter = wx.getStorageSync('lia_lang');
    const navDelay = wx.getStorageSync('lia_nav_delay');

    if (token) this.globalData.token = token;
    if (userInfo) this.globalData.userInfo = userInfo;
    if (langFilter !== '') this.globalData.langFilter = langFilter;
    if (navDelay !== '') this.globalData.navDelay = navDelay;
  },

  setNavDelay(ms) {
    this.globalData.navDelay = ms;
    wx.setStorageSync('lia_nav_delay', ms);
  },

  // 手机号登录
  phoneLogin(phone, password, callback) {
    this.request({
      url: '/auth/user/login',
      method: 'POST',
      skipAuth: true,
      data: { phone, password },
      success: (res) => {
        const token = res.data;
        this.globalData.token = token;
        wx.setStorageSync('lia_token', token);
        this.request({
          url: `/user/auth/${phone}`,
          success: (userRes) => {
            const user = userRes.data;
            this.globalData.userInfo = user;
            wx.setStorageSync('lia_user', user);
            callback && callback(null, user);
          },
          fail: (err) => callback && callback(err),
        });
      },
      fail: (err) => callback && callback(err),
    });
  },

  // 手机号注册（注册成功后自动登录）
  phoneRegister(phone, password, nickName, callback) {
    this.request({
      url: '/auth/user/register',
      method: 'POST',
      skipAuth: true,
      data: { phone, password, nick_name: nickName || '匿名调查员' },
      success: () => {
        this.phoneLogin(phone, password, callback);
      },
      fail: (err) => callback && callback(err),
    });
  },

  // 微信登录
  wxLogin(callback) {
    wx.getUserProfile({
      desc: '用于完善档案员档案',
      success: (profileRes) => {
        wx.login({
          success: (loginRes) => {
            if (!loginRes.code) {
              wx.showToast({ title: '登录失败', icon: 'none' });
              callback && callback(new Error('no code'));
              return;
            }
            this.request({
              url: '/auth/user/wechat-login',
              method: 'POST',
              skipAuth: true,
              data: {
                code: loginRes.code,
                nick_name: profileRes.userInfo.nickName,
                avatar_url: profileRes.userInfo.avatarUrl,
                gender: profileRes.userInfo.gender,
              },
              success: (res) => {
                const { token, user } = res.data;
                this.globalData.token = token;
                this.globalData.userInfo = user;
                wx.setStorageSync('lia_token', token);
                wx.setStorageSync('lia_user', user);
                callback && callback(null, user);
              },
              fail: (err) => {
                callback && callback(err || new Error('login failed'));
              },
            });
          },
          fail: (err) => {
            callback && callback(err);
          },
        });
      },
      fail: () => {
        wx.showToast({ title: '需要授权才能登录', icon: 'none' });
        callback && callback(new Error('user denied'));
      },
    });
  },

  // 登出
  logout() {
    this.globalData.token = '';
    this.globalData.userInfo = null;
    wx.removeStorageSync('lia_token');
    wx.removeStorageSync('lia_user');
  },

  // 是否已登录
  isLoggedIn() {
    return !!(this.globalData.token && this.globalData.userInfo);
  },

  // 需要登录时调用：未登录则跳转登录页并返回 false
  requireLogin() {
    if (this.isLoggedIn()) return true;
    wx.navigateTo({ url: '/pages/login/login' });
    return false;
  },

  // 语言过滤偏好
  setLangFilter(lang) {
    this.globalData.langFilter = lang;
    wx.setStorageSync('lia_lang', lang);
  },

  // 全局请求封装
  // silent: true 时不弹 toast，由调用方自行处理错误展示
  request(options) {
    const { url, method = 'GET', data, success, fail, skipAuth, silent } = options;

    const HTTP_ERRORS = {
      400: '请求参数有误',
      403: '没有操作权限',
      404: '资源不存在',
      429: '操作过于频繁',
      500: '服务器异常',
      502: '服务不可用',
      503: '服务维护中',
    };

    const showError = (msg) => {
      if (!silent) wx.showToast({ title: msg, icon: 'none', duration: 2000 });
    };

    wx.request({
      url: `${this.globalData.baseUrl}${url}`,
      method,
      data,
      header: {
        'Authorization': skipAuth ? '' : `Bearer ${this.globalData.token}`,
        'Content-Type': 'application/json',
      },
      success: (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          const body = res.data;
          // 业务层错误：HTTP 200 但 body.code 为非 2xx 错误码
          if (body && typeof body.code === 'number' && body.code >= 300) {
            showError(body.message || '操作失败');
            fail && fail(body);
            return;
          }
          success && success(body);
        } else if (res.statusCode === 401 && !skipAuth) {
          showError('登录已过期，请重新登录');
          this.logout();
          wx.navigateTo({ url: '/pages/login/login' });
          fail && fail(res);
        } else {
          const msg = (res.data && res.data.message)
            || HTTP_ERRORS[res.statusCode]
            || '请求失败';
          showError(msg);
          fail && fail(res);
        }
      },
      fail: (err) => {
        showError('网络异常，请检查连接');
        fail && fail(err);
      },
    });
  },
});
