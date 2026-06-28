// utils/util.js - 工具函数

function formatTime(dateStr) {
  if (!dateStr) return '未知时间';

  const raw =
    typeof dateStr === 'object' && dateStr.dateTime
      ? dateStr.dateTime
      : dateStr;

  try {
    const date = new Date(raw);

    const pad = (n) => String(n).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();

    // 从“最小单位”开始判断是否为 0
    const hasSecond = second !== 0;
    const hasMinute = minute !== 0 || hasSecond;
    const hasHour = hour !== 0 || hasMinute;

    let result = `${year}.${month}.${day}`;

    if (hasHour) {
      result += ` ${pad(hour)}:${pad(minute)}`;
    }

    if (hasSecond) {
      result += `:${pad(second)}`;
    }

    return result;
  } catch (e) {
    return '时间格式错误';
  }
}

const ARCHIVE_TYPES = {
  0: { label: '民间档案', className: 'badge-type-folk',     code: '民間' },
  1: { label: '官方档案', className: 'badge-type-official', code: '官方' },
  2: { label: '第三方档案', className: 'badge-type-third',  code: '三方' },
};

const ARCHIVE_STATUS = {
  0: { label: '未结案', className: 'badge-status-ongoing', dot: '●' },
  1: { label: '已结案', className: 'badge-status-closed',  dot: '◆' },
};

const ARCHIVE_LANG = {
  0: '中',
  1: 'EN',
};

function generateArchiveNo(id, occurredAt) {
  const year = occurredAt ? new Date(occurredAt).getFullYear() : 'XXXX';
  const idStr = String(id || 0).padStart(8, '0');
  return `CASE-${year}-${idStr}`;
}

// 兼容后端字段命名 (snake_case 和 camelCase 两种风格)
function normalizeArchive(item) {
  return {
    ...item,
    occurredAt: item.occurredAt || item.occurred_at || null,
    createdAt: item.createdAt || item.created_at || null,
    updatedAt: item.updatedAt || item.updated_at || null,
    closedAt: item.closedAt || item.closed_at || null,
  };
}

// 从 HTML（editor 输出）或 Markdown 内容中提取第一张封面图 URL
function extractCoverImage(content) {
  if (!content) return null;

  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  const urls = content.match(urlRegex);
  if (!urls) return null;

  for (const url of urls) {
    if (/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)) {
      return url;
    }
  }

  return null;
}

function processArchive(item) {
  const normalized = normalizeArchive(item);
  // 解析 tags（可能是 JSON 字符串或已解析数组）
  let tags = normalized.tags;
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags); } catch (e) { tags = []; }
  }
  tags = Array.isArray(tags) ? tags : [];

  const type = ARCHIVE_TYPES[normalized.type] || ARCHIVE_TYPES[0];
  const status = ARCHIVE_STATUS[normalized.status] || ARCHIVE_STATUS[0];

  // 纯文本预览：兼容 HTML 内容（editor 输出）和旧 Markdown 内容
  const rawContent = normalized.content || '';
  const previewText = rawContent
    .replace(/<[^>]+>/g, '')               // 剥离 HTML 标签
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')  // 剥离 Markdown 图片
    .replace(/\[视频:[^\]]*\]/g, '')        // 剥离视频标记
    .replace(/#{1,6}\s|[*_`>]/g, '')       // 剥离 Markdown 语法符号
    .replace(/\s+/g, ' ')
    .trim();

  return {
    ...normalized,
    tags,
    coverImage: extractCoverImage(rawContent),
    archiveNo: generateArchiveNo(normalized.id, normalized.occurredAt),
    typeInfo: type,
    statusInfo: status,
    langCode: ARCHIVE_LANG[normalized.lang] !== undefined ? ARCHIVE_LANG[normalized.lang] : '?',
    occurredAtFmt: formatTime(normalized.occurredAt),
    createdAtFmt: formatTime(normalized.createdAt),
    updatedAtFmt: formatTime(normalized.updatedAt),
    closedAtFmt: formatTime(normalized.closedAt),
    contentPreview: previewText
      ? previewText.substring(0, 80) + (previewText.length > 80 ? '...' : '')
      : '暂无档案内容记录',
  };
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

// 解析行内 Markdown 格式（粗体、斜体、行内代码）
function parseInlineSpans(text) {
  const spans = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) spans.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined)      spans.push({ type: 'bold',   text: m[1] });
    else if (m[2] !== undefined) spans.push({ type: 'italic', text: m[2] });
    else if (m[3] !== undefined) spans.push({ type: 'code',   text: m[3] });
    last = regex.lastIndex;
  }
  if (last < text.length) spans.push({ type: 'text', text: text.slice(last) });
  return spans.length ? spans : [{ type: 'text', text }];
}

// 将 Markdown 字符串解析为 block 列表，供 WXML 渲染
function parseMarkdown(content) {
  if (!content) return [];
  const blocks = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) { i++; continue; }

    // 代码块
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', text: codeLines.join('\n'), lang });
      i++; continue;
    }

    // 标题
    if (trimmed.startsWith('### ')) { blocks.push({ type: 'h3', text: trimmed.slice(4) }); i++; continue; }
    if (trimmed.startsWith('## '))  { blocks.push({ type: 'h2', text: trimmed.slice(3) }); i++; continue; }
    if (trimmed.startsWith('# '))   { blocks.push({ type: 'h1', text: trimmed.slice(2) }); i++; continue; }

    // 水平线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { blocks.push({ type: 'hr' }); i++; continue; }

    // 引用块
    if (trimmed.startsWith('> ')) { blocks.push({ type: 'blockquote', text: trimmed.slice(2) }); i++; continue; }

    // 无序列表
    if (/^[-*+] /.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*+] /.test(lines[i].trim())) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    // 独占一行的图片 / 视频：![alt](url)
    const mediaMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (mediaMatch) {
      const alt = mediaMatch[1];
      const src = mediaMatch[2];
      if (/\.(mp4|mov|avi|webm|m3u8)$/i.test(src) || /^video$/i.test(alt)) {
        blocks.push({ type: 'video', src, alt });
      } else {
        blocks.push({ type: 'image', src, alt });
      }
      i++; continue;
    }

    // 普通段落（含行内格式）
    blocks.push({ type: 'p', spans: parseInlineSpans(trimmed) });
    i++;
  }

  return blocks;
}

module.exports = {
  formatTime,
  ARCHIVE_TYPES,
  ARCHIVE_STATUS,
  ARCHIVE_LANG,
  generateArchiveNo,
  processArchive,
  truncate,
  parseMarkdown,
  parseInlineSpans,
};
