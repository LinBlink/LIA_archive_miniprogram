// pages/index/index.js
const app = getApp();
const { processArchive } = require('../../utils/util');

const PAGE_SIZE = 10;

Page({
  data: {
    archiveList: [],
    totalCount: 0,
    ongoingCount: 0,
    closedCount: 0,
    activeFilter: 'all',
    loading: true,
    hasMore: true,
    isOnline: true,
    page: 1,
  },

  onLoad() {
    this.loadStats();
    this.loadArchives(true);
  },

  onShow() {
    // 每次显示时刷新列表（新建档案后回来）
  },

  // 加载统计数据
  loadStats() {
    app.request({
      url: '/archives/stats',
      success: (res) => {
        this.setData({
          totalCount: res.data.total || 0,
          ongoingCount: res.data.ongoing || 0,
          closedCount: res.data.closed || 0,
        });
      }
    });
  },

  // 加载档案列表
  loadArchives(reset = false) {
    if (reset) {
      this.setData({ page: 1, archiveList: [], hasMore: true });
    }

    if (!this.data.hasMore && !reset) return;

    const { activeFilter, page } = this.data;

    // 构建查询参数
    const params = {
      page,
      pageSize: PAGE_SIZE,
    };

    if (activeFilter === 'ongoing') params.status = 0;
    else if (activeFilter === 'closed') params.status = 1;
    else if (['0', '1', '2'].includes(activeFilter)) params.type = parseInt(activeFilter);

    this.setData({ loading: reset });

    app.request({
      url: '/archives',
      data: params,
      success: (res) => {
        const rawList = res.data.list || [];
        const processed = rawList.map(processArchive);
        const newList = reset ? processed : [...this.data.archiveList, ...processed];

        this.setData({
          archiveList: newList,
          hasMore: rawList.length === PAGE_SIZE,
          loading: false,
          isOnline: true,
        });
      },
      fail: () => {
        this.setData({ loading: false, isOnline: false });
        // 离线模式：加载 mock 数据用于展示
        this.loadMockData();
      }
    });
  },

  // Mock 数据（开发调试用）
  loadMockData() {
    const mock = [
      {
        id: 1, title: '广州某居民楼的集体失忆事件', type: 1, status: 0,
        lang: 0, content: '2019年3月，广东省广州市荔湾区某居民楼内，17名居民在同一时间段内出现持续约3小时的完整记忆空白。事件发生期间，楼内监控画面异常，相邻路段交通信号灯发生无规律闪烁。',
        location_desc: '广东省广州市荔湾区', occurred_at: '2019-03-14T02:00:00Z',
        created_at: '2023-01-01T00:00:00Z', updated_at: '2024-03-01T00:00:00Z',
        closed_at: null, is_private: 0, view_count: 1024,
      },
      {
        id: 2, title: '福建省沿海渔村的周期性消失现象', type: 0, status: 1,
        lang: 0, content: '据当地渔民口述，每隔三年的冬至前后，某无名小岛会在清晨出现于海图标记外海域，持续约两周后消失。岛上留有人类活动痕迹，但从未发现岛屿居民。',
        location_desc: '福建省福州市沿海', occurred_at: '2021-12-22T00:00:00Z',
        created_at: '2023-06-15T00:00:00Z', updated_at: '2024-01-20T00:00:00Z',
        closed_at: '2024-01-20T00:00:00Z', is_private: 0, view_count: 3840,
      },
      {
        id: 3, title: '成都某地铁站的多人异步幻听报告', type: 2, status: 0,
        lang: 0, content: '2023年7月至10月间，成都地铁2号线某站候车乘客共计上报142例幻听事件。所有描述均指向相同内容：播报系统在正常报站之外，重复播放一段"下一站，阈界"的异常广播。',
        location_desc: '四川省成都市地铁2号线', occurred_at: '2023-07-01T00:00:00Z',
        created_at: '2023-11-03T00:00:00Z', updated_at: '2024-05-01T00:00:00Z',
        closed_at: null, is_private: 0, view_count: 8920,
      },
    ];
    this.setData({
      archiveList: mock.map(processArchive),
      loading: false,
      totalCount: 3,
      ongoingCount: 2,
      closedCount: 1,
    });
  },

  // 筛选切换
  onFilterChange(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ activeFilter: value });
    this.loadArchives(true);
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.hasMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadArchives(false);
  },

  // 点击卡片
  onCardTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 新建档案
  onCreateTap() {
    wx.navigateTo({ url: '/pages/create/create' });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadStats();
    this.loadArchives(true);
    wx.stopPullDownRefresh();
  },

  // 上拉加载更多
  onReachBottom() {
    this.onLoadMore();
  },
});
