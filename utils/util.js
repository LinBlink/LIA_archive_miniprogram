// utils/util.js - 工具函数

/**
 * 格式化时间戳
 */
function formatTime(dateStr) {
  if (!dateStr) return '未知时间';
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

/**
 * 档案类型配置
 */
const ARCHIVE_TYPES = {
  0: { label: '民间档案', className: 'badge-type-folk', code: '民間' },
  1: { label: '官方档案', className: 'badge-type-official', code: '官方' },
  2: { label: '第三方档案', className: 'badge-type-third', code: '三方' },
};

/**
 * 档案状态配置
 */
const ARCHIVE_STATUS = {
  0: { label: '更新中', className: 'badge-status-ongoing', dot: '●' },
  1: { label: '已完结', className: 'badge-status-closed', dot: '◆' },
};

/**
 * 语言配置
 */
const ARCHIVE_LANG = {
  0: '中',
  1: 'EN',
};

/**
 * 生成档案编号（前端展示用）
 * 格式：ARC-{年份}-{ID补零}
 */
function generateArchiveNo(id, createdAt) {
  const year = createdAt ? new Date(createdAt).getFullYear() : '????';
  const idStr = String(id || 0).padStart(4, '0');
  return `ARC-${year}-${idStr}`;
}

/**
 * 处理单条档案数据，补充展示字段
 */
function processArchive(item) {
  const type = ARCHIVE_TYPES[item.type] || ARCHIVE_TYPES[0];
  const status = ARCHIVE_STATUS[item.status] || ARCHIVE_STATUS[0];
  return {
    ...item,
    archiveNo: generateArchiveNo(item.id, item.created_at),
    typeInfo: type,
    statusInfo: status,
    langCode: ARCHIVE_LANG[item.lang] || 'ZH',
    occurredAtFmt: formatTime(item.occurred_at),
    createdAtFmt: formatTime(item.created_at),
    updatedAtFmt: formatTime(item.updated_at),
    closedAtFmt: formatTime(item.closed_at),
    contentPreview: item.content
      ? item.content.replace(/\n/g, ' ').substring(0, 80) + (item.content.length > 80 ? '...' : '')
      : '暂无档案内容记录',
  };
}

/**
 * 截断文字
 */
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

module.exports = {
  formatTime,
  ARCHIVE_TYPES,
  ARCHIVE_STATUS,
  generateArchiveNo,
  processArchive,
  truncate,
};
