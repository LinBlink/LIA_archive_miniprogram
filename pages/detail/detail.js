// pages/detail/detail.js
const app = getApp();
const { processArchive } = require('../../utils/util');

Page({
  data: {
    archive: null,
    isCollected: false,
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.loadDetail(id);
    }
  },

  loadDetail(id) {
    app.request({
      url: `/archives/${id}`,
      success: (res) => {
        const processed = processArchive(res.data);
        // 解析 JSON 字段
        if (typeof processed.characters === 'string') {
          try { processed.characters = JSON.parse(processed.characters); } catch(e) { processed.characters = null; }
        }
        if (typeof processed.timelines === 'string') {
          try { processed.timelines = JSON.parse(processed.timelines); } catch(e) { processed.timelines = null; }
        }
        if (typeof processed.evidence === 'string') {
          try { processed.evidence = JSON.parse(processed.evidence); } catch(e) { processed.evidence = null; }
        }
        if (typeof processed.ref_links === 'string') {
          try { processed.ref_links = JSON.parse(processed.ref_links); } catch(e) { processed.ref_links = null; }
        }
        this.setData({ archive: processed });
        wx.setNavigationBarTitle({ title: processed.title });
      },
      fail: () => {
        // 使用 mock 数据
        this.loadMockDetail(id);
      }
    });
  },

  loadMockDetail(id) {
    const mock = {
      id: parseInt(id) || 1,
      title: '广州某居民楼的集体失忆事件',
      type: 1, status: 0, lang: 0,
      content: `2019年3月14日凌晨2时至5时，广东省广州市荔湾区某居民楼内，共有17名居民在事后报告出现持续约3小时的完整记忆空白。

事件初步调查：
当日凌晨，楼栋物业监控系统发生未知故障，时间戳显示画面冻结于01:58:32，直至05:03:17恢复。相邻路段5组交通信号灯同时出现无规律闪烁，持续约40分钟。

居民描述：
17名受访居民均表示，最后的记忆停留在约凌晨2时，此后直至清晨5时的记忆完全缺失，期间无任何主观时间流逝感。部分居民报告在记忆缺失期结束后发现自己处于家中不寻常位置，且房间温度异常偏低。

目前状态：
该事件已引起地方性关注，正在进行深入调查中。官方暂未发布正式说明。`,
      characters: [
        { id: 1, name: '张女士', role: '主要证人 / 楼栋住户', desc: '最早向媒体反映该事件的居民，记忆缺失前正准备出门工作。', color: '#C8392B' },
        { id: 2, name: '物业管理员李某', role: '相关人员', desc: '负责该楼栋的夜班物业，本人也报告有记忆空白，但自称不记得当晚曾在岗。', color: '#C87040' },
        { id: 3, name: '匿名调查员', role: '第三方调查', desc: '对外公开身份的调查人员，已收集多份证词，联系方式见参考链接。', color: '#4A7C6F' },
      ],
      timelines: [
        { time: '2019-03-14 / 01:58', event: '监控系统画面冻结', detail: '楼栋全部监控摄像头同时停止记录，运营商服务器无异常报告。' },
        { time: '2019-03-14 / 约02:00', event: '记忆空白期开始', detail: '根据17名居民事后描述推断，集体记忆缺失约从此时起。' },
        { time: '2019-03-14 / 02:00–05:00', event: '交通信号灯异常', detail: '相邻路段信号灯出现持续约40分钟的无规律闪烁后自行恢复。' },
        { time: '2019-03-14 / 05:03', event: '监控恢复 / 居民苏醒', detail: '监控时间戳重新同步，居民陆续报告"恢复意识"，部分人发现自身位移。' },
        { time: '2019-03-15', event: '首份目击者证词收集完毕', detail: '共17份。匿名调查员开始整理档案。' },
      ],
      evidence: [
        { title: '监控时间戳异常截图', desc: '显示冻结时间与恢复时间，时间差精确为3小时4分45秒。', tags: ['视频', '监控', '时间戳'], credibility: '★★★' },
        { title: '交通灯维修工单', desc: '该区域路段维修工单显示当日无预定维护作业。', tags: ['官方文件', '公共设施'], credibility: '★★★★' },
        { title: '17份居民证词', desc: '内容高度一致，均指向相同时间段、相同类型的记忆缺失。', tags: ['目击证词', '多人'], credibility: '★★★' },
        { title: '气象记录', desc: '当夜气象站数据正常，无特殊天气现象。', tags: ['气象', '环境'], credibility: '★★★★★' },
      ],
      ref_links: [
        { title: '南方都市报相关报道（存档）', url: 'https://example.com/nanfang-report' },
        { title: '匿名调查员原始记录帖', url: 'https://example.com/anonymous-thread' },
      ],
      location_desc: '广东省广州市荔湾区',
      occurred_at: '2019-03-14T02:00:00Z',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2024-03-01T00:00:00Z',
      closed_at: null, is_private: 0, view_count: 1024,
    };
    const processed = processArchive(mock);
    this.setData({ archive: processed });
    wx.setNavigationBarTitle({ title: processed.title });
  },

  onRefTap(e) {
    const url = e.currentTarget.dataset.url;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'none' })
    });
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true });
  },

  onCollect() {
    this.setData({ isCollected: !this.data.isCollected });
    wx.showToast({
      title: this.data.isCollected ? '已添加收藏' : '已取消收藏',
      icon: 'none',
    });
  },

  onShareAppMessage() {
    const { archive } = this.data;
    return {
      title: archive ? `【閾界档案】${archive.title}` : '閾界档案馆',
      path: `/pages/detail/detail?id=${archive ? archive.id : ''}`,
    };
  },
});
