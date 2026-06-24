// app.js - 閾界档案馆 全局入口
App({
  globalData: {
    userInfo: null,
    baseUrl: 'https://your-api-domain.com/api', // 替换为实际接口地址
    token: '',
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
    }
  },

  // 全局请求封装
  request(options) {
    const { url, method = 'GET', data, success, fail } = options;
    wx.request({
      url: `${this.globalData.baseUrl}${url}`,
      method,
      data,
      header: {
        'Authorization': `Bearer ${this.globalData.token}`,
        'Content-Type': 'application/json',
      },
      success: (res) => {
        if (res.statusCode === 200) {
          success && success(res.data);
        } else if (res.statusCode === 401) {
          wx.navigateTo({ url: '/pages/login/login' });
        } else {
          fail && fail(res);
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        fail && fail(err);
      }
    });
  }
});
