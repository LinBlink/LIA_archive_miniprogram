// utils/draft.js — 本地多份草稿管理

const DRAFTS_KEY = 'lia_drafts';
const MAX_DRAFTS = 30;

function getDrafts() {
  return wx.getStorageSync(DRAFTS_KEY) || [];
}

function getDraftById(id) {
  return getDrafts().find(d => d.id === id) || null;
}

function saveDraft(id, fields) {
  const drafts = getDrafts();
  const updatedAt = new Date().toISOString();
  // 去除 Markdown 符号后取前 60 字作预览
  const preview = (fields.content || '')
    .replace(/[#>\-*`|!\[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  const entry = { ...fields, id, updatedAt, preview };
  const idx = drafts.findIndex(d => d.id === id);
  if (idx >= 0) {
    drafts[idx] = entry;
  } else {
    drafts.unshift(entry);
    if (drafts.length > MAX_DRAFTS) drafts.pop();
  }
  wx.setStorageSync(DRAFTS_KEY, drafts);
  return entry;
}

function deleteDraft(id) {
  const drafts = getDrafts().filter(d => d.id !== id);
  wx.setStorageSync(DRAFTS_KEY, drafts);
}

function formatDraftTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH} 小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)    return `${diffD} 天前`;
  const Y = d.getFullYear(), M = String(d.getMonth() + 1).padStart(2, '0'), D = String(d.getDate()).padStart(2, '0');
  return `${Y}.${M}.${D}`;
}

module.exports = { getDrafts, getDraftById, saveDraft, deleteDraft, formatDraftTime };
