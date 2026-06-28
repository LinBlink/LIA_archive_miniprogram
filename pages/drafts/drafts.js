// pages/drafts/drafts.js
const { getDrafts, deleteDraft, formatDraftTime } = require('../../utils/draft');

Page({
  data: {
    drafts: [],
    empty: false,
  },

  onShow() {
    this._loadDrafts();
  },

  _loadDrafts() {
    const raw = getDrafts();
    const drafts = raw.map(d => ({
      ...d,
      displayTitle:   d.title || '无标题草稿',
      displayTime:    formatDraftTime(d.updatedAt),
      displayPreview: d.preview || '（无内容）',
    }));
    this.setData({ drafts, empty: drafts.length === 0 });
  },

  onDraftTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/create/create?draftId=${id}` });
  },

  onDeleteTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除草稿',
      content: '确定要删除这份草稿吗？此操作无法撤销。',
      confirmText: '删除',
      confirmColor: '#C8392B',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        deleteDraft(id);
        this._loadDrafts();
        wx.showToast({ title: '草稿已删除', icon: 'none' });
      },
    });
  },

  onClearAll() {
    if (this.data.drafts.length === 0) return;
    wx.showModal({
      title: '清空草稿箱',
      content: `确定要删除全部 ${this.data.drafts.length} 份草稿吗？`,
      confirmText: '全部删除',
      confirmColor: '#C8392B',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        this.data.drafts.forEach(d => deleteDraft(d.id));
        this._loadDrafts();
        wx.showToast({ title: '草稿箱已清空', icon: 'none' });
      },
    });
  },

  onNewDraft() {
    wx.navigateTo({ url: '/pages/create/create' });
  },
});
