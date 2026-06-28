// pages/detail/detail.js
const app = getApp();
const { processArchive, formatTime } = require('../../utils/util');

const EVIDENCE_TYPES = {
  physical:    { label: '实物证据', icon: '◉' },
  documentary: { label: '文件证据', icon: '◈' },
  testimonial: { label: '证人证词', icon: '◎' },
  video:       { label: '影像证据', icon: '▶' },
  audio:       { label: '音频证据', icon: '♪' },
};

const RELIABILITY = {
  high:   { label: '高', className: 'rel-high' },
  medium: { label: '中', className: 'rel-medium' },
  low:    { label: '低', className: 'rel-low' },
};

const IMPORTANCE = {
  critical: { className: 'tl-critical', label: '关键' },
  high:     { className: 'tl-high',     label: '重要' },
  normal:   { className: 'tl-normal',   label: '' },
};

const RELATION_TYPE = {
  corroborates:  '印证',
  leads_to:      '指向',
  derived_from:  '派生自',
  contradicts:   '矛盾',
  supports:      '支持',
};

// 证据关系图——画布颜色（与 CSS 变量对应的 hex 值）
const EV_COLORS = {
  physical:    { fill: '#0E1822', stroke: '#243444', accent: '#5A8098' },
  documentary: { fill: '#1A0E06', stroke: '#442810', accent: '#C87040' },
  testimonial: { fill: '#061410', stroke: '#103228', accent: '#5dccad' },
  video:       { fill: '#100C1C', stroke: '#2C1450', accent: '#9A6ACA' },
  audio:       { fill: '#08141E', stroke: '#142C40', accent: '#4AACCA' },
};
const EV_REL_FILL = { high: '#5dccad', medium: '#C87040', low: '#C8392B' };

Page({
  data: {
    archive: null,
    archiveId: null,
    isAuthor: false,
    isCollected: false,
    contentSegments: [],
    comments: [],
    commentText: '',
    commentsLoading: false,
    commentSubmitting: false,
    commentPage: 1,
    commentHasMore: true,
    expandedCharEdge: null,
    navSections: [],
    activeSectionId: '',
    navVisible: false,
    evidenceSelectedNode: null,
    authorAvatarError: false,
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ archiveId: id });
      this.loadDetail(id);
      this.loadComments(id, true);
      this.recordView(id);
      if (app.isLoggedIn()) {
        this.checkCollected(id);
      }
    }
  },

  onShow() {
    const { archiveId, archive } = this.data;
    // archive 为 null 说明首次加载尚未完成，由 onLoad 处理，不重复请求
    if (!archiveId || !archive) return;
    if (app.globalData.contentUpdated) {
      this.loadDetail(archiveId);
      this.loadComments(archiveId, true);
    }
  },

  recordView(id) {
    app.request({
      url: `/archives/${id}/view`,
      method: 'POST',
      fail: () => {},
    });
  },

  loadDetail(id) {
    app.request({
      url: `/archives/${id}`,
      success: (res) => {
        const processed = processArchive(res.data);
        this._parseJsonFields(processed);
        const raw = res.data || {};
        // 归一化 author 子对象（兼容 camelCase 和 snake_case）
        const rawAuthor = raw.author || raw.authorInfo || null;
        const author = rawAuthor ? {
          id:         rawAuthor.id,
          nick_name:  rawAuthor.nick_name  || rawAuthor.nickName  || rawAuthor.nickname || '匿名调查员',
          avatar_url: rawAuthor.avatar_url || rawAuthor.avatarUrl || rawAuthor.avatar   || '',
          level:      rawAuthor.level      != null ? rawAuthor.level : null,
        } : null;
        // 归一化 author_id（兼容 camelCase）
        const authorId = raw.author_id || raw.authorId || (rawAuthor && rawAuthor.id) || null;
        const archive = {
          ...processed,
          author,
          author_id:  authorId,
          characters: this._processCharacters(processed.characters),
          timelines:  this._processTimelines(processed.timelines),
          evidence:   this._processEvidence(processed.evidence),
        };
        const userInfo = app.globalData.userInfo;
        const isAuthor = !!(userInfo && authorId && String(userInfo.id) === String(authorId));
        this.setData({ archive, isAuthor });
        this._processContent(processed.content);
        wx.setNavigationBarTitle({ title: processed.title });
        if (archive.evidence && archive.evidence.nodes && archive.evidence.nodes.length > 0) {
          setTimeout(() => this._drawEvidenceGraph(), 100);
        }
      },
      fail: () => {
        this.loadMockDetail(id);
      },
    });
  },

  // 将 markdown 解析为块级片段数组
  _processContent(markdown) {
    if (!markdown) {
      this.setData({ contentSegments: [] });
      this._buildNavSections([]);
      return;
    }
    const lines = markdown.split('\n');
    const segs = [];
    let i = 0;
    let headingIdx = 0;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) { i++; continue; }
      if (/^### /.test(t)) { segs.push({ type: 'h3', text: t.slice(4) }); i++; continue; }
      if (/^## /.test(t))  { segs.push({ type: 'h2', text: t.slice(3), navId: 'md-h-' + headingIdx++ }); i++; continue; }
      if (/^# /.test(t))   { segs.push({ type: 'h1', text: t.slice(2), navId: 'md-h-' + headingIdx++ }); i++; continue; }
      if (/^-{3,}$/.test(t)) { segs.push({ type: 'hr' }); i++; continue; }
      if (/^> /.test(t)) {
        segs.push({ type: 'blockquote', html: this._inlineHtml(t.slice(2)) });
        i++; continue;
      }
      if (/^[-*+] /.test(t)) {
        const items = [];
        while (i < lines.length && /^[-*+] /.test(lines[i].trim())) {
          items.push(this._inlineHtml(lines[i].trim().replace(/^[-*+] /, '')));
          i++;
        }
        segs.push({ type: 'list', items });
        continue;
      }
      const mm = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (mm) {
        const src = mm[2].trim();
        segs.push(mm[1] === 'video' || /\.(mp4|mov|avi|webm)(\?|$)/i.test(src)
          ? { type: 'video', src }
          : { type: 'image', src, alt: mm[1] });
        i++; continue;
      }
      // Markdown 表格：连续的 | 开头行
      if (t.startsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const parseRow = line =>
            line.replace(/^\||\|$/g, '').split('|').map(c => this._inlineHtml(c.trim()));
          const headers = parseRow(tableLines[0]);
          // tableLines[1] 是分隔行 |---|---|，跳过
          const rows = tableLines.slice(2).map(parseRow);
          // 每列至少 220rpx，确保宽表格能超出视口触发横向滚动
          const tableWidth = (headers.length * 220) + 'rpx';
          segs.push({ type: 'table', headers, rows, tableWidth });
        }
        continue;
      }
      segs.push({ type: 'p', html: this._inlineHtml(t) });
      i++;
    }
    this.setData({ contentSegments: segs });
    this._buildNavSections(segs);
    this._startImageTimeouts(segs);
  },

  // 为每张内容图片启动超时计时器（15s），超时后取消展示
  _startImageTimeouts(segs) {
    if (this._imgTimers) {
      Object.values(this._imgTimers).forEach(t => clearTimeout(t));
    }
    this._imgTimers = {};
    segs.forEach((seg, idx) => {
      if (seg.type !== 'image') return;
      this._imgTimers[idx] = setTimeout(() => {
        const cur = this.data.contentSegments[idx];
        if (cur && !cur.imgLoaded) {
          this.setData({ ['contentSegments[' + idx + '].imgHidden']: true });
        }
      }, 15000);
    });
  },

  onMdImageLoad(e) {
    const idx = e.currentTarget.dataset.index;
    if (this._imgTimers && this._imgTimers[idx]) {
      clearTimeout(this._imgTimers[idx]);
      delete this._imgTimers[idx];
    }
    this.setData({ ['contentSegments[' + idx + '].imgLoaded']: true });
  },

  onMdImageError(e) {
    const idx = e.currentTarget.dataset.index;
    if (this._imgTimers && this._imgTimers[idx]) {
      clearTimeout(this._imgTimers[idx]);
      delete this._imgTimers[idx];
    }
    this.setData({ ['contentSegments[' + idx + '].imgHidden']: true });
  },

  onAuthorAvatarError() {
    this.setData({ authorAvatarError: true });
  },

  onCommentAvatarError(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.comments.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.setData({ ['comments[' + idx + '].avatarError']: true });
    }
  },

  // markdown 行内格式 → HTML（供 rich-text 渲染）
  _inlineHtml(text) {
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    text = text.replace(/`([^`]+)`/g,
      '<code style="font-family:monospace;color:#8dffdf;background:#161C22;padding:0 4px;border-radius:3px;">$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g,
      '<strong style="font-weight:700;color:#E8DCC8;">$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return text;
  },

  _buildNavSections(segs) {
    const { archive } = this.data;
    if (!archive) return;
    const ch = archive.characters;
    const tl = archive.timelines;
    const ev = archive.evidence;

    const all = [{ id: 'sec-01', code: '§01', label: '基础信息', kind: 'section' }];

    if (segs && segs.length > 0) {
      all.push({ id: 'sec-02', code: '§02', label: '事件档案', kind: 'section' });
      segs.filter(s => (s.type === 'h1' || s.type === 'h2') && s.navId).forEach(s => {
        const label = s.text.length > 10 ? s.text.slice(0, 10) + '…' : s.text;
        all.push({ id: s.navId, code: s.type === 'h1' ? '▶' : '▸', label, kind: s.type });
      });
    }
    if (ch && ch.nodes && ch.nodes.length > 0)
      all.push({ id: 'sec-03', code: '§03', label: '人物关系', kind: 'section' });
    if (tl && tl.length > 0)
      all.push({ id: 'sec-04', code: '§04', label: '时间线', kind: 'section' });
    if (ev && ev.nodes && ev.nodes.length > 0)
      all.push({ id: 'sec-05', code: '§05', label: '证据链', kind: 'section' });
    if (archive.ref_links && archive.ref_links.length > 0)
      all.push({ id: 'sec-06', code: '§06', label: '参考来源', kind: 'section' });
    all.push({ id: 'sec-07', code: '§07', label: '讨论区', kind: 'section' });

    const activeSectionId = all[0] ? all[0].id : '';
    this.setData({ navSections: all, activeSectionId });
    wx.nextTick(() => this._querySectionTops(all));
  },

  _querySectionTops(sections) {
    const query = wx.createSelectorQuery();
    sections.forEach(s => query.select(`#${s.id}`).boundingClientRect());
    query.selectViewport().scrollOffset();
    query.exec(res => {
      const scrollInfo = res[res.length - 1];
      const scrollTop = scrollInfo ? scrollInfo.scrollTop : 0;
      const tops = {};
      sections.forEach((s, i) => {
        if (res[i]) tops[s.id] = res[i].top + scrollTop;
      });
      this._sectionTops = tops;
    });
  },

  _startHideTimer() {
    clearTimeout(this._hideNavTimer);
    const delay = app.globalData.navDelay;
    if (delay === 0) return;
    this._hideNavTimer = setTimeout(() => this.setData({ navVisible: false }), delay);
  },

  onPageScroll(e) {
    const { navSections, activeSectionId, navVisible } = this.data;

    if (!navVisible) this.setData({ navVisible: true });
    this._startHideTimer();

    if (!navSections.length || !this._sectionTops) return;
    const scrollTop = e.scrollTop + 60;
    let activeId = navSections[0].id;
    for (const s of navSections) {
      const top = this._sectionTops[s.id];
      if (top !== undefined && scrollTop >= top) activeId = s.id;
    }
    if (activeId !== activeSectionId) this.setData({ activeSectionId: activeId });
  },

  onNavTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.pageScrollTo({ selector: `#${id}`, duration: 300, offsetTop: -16 });
    this.setData({ activeSectionId: id });
    this._startHideTimer();
  },

  _parseJsonFields(item) {
    ['characters', 'timelines', 'evidence', 'ref_links', 'tags'].forEach((key) => {
      if (typeof item[key] === 'string') {
        try { item[key] = JSON.parse(item[key]); } catch (e) { item[key] = null; }
      }
    });
  },

  // 兼容旧数组格式和新 {nodes, edges} 图格式
  _processCharacters(characters) {
    if (!characters) return null;
    if (Array.isArray(characters)) {
      return {
        nodes: characters.map(c => ({ ...c, description: c.description || c.desc, tags: [] })),
        edges: [],
      };
    }
    if (!characters.nodes) return null;
    const nodeMap = {};
    characters.nodes.forEach(n => { nodeMap[n.id] = n.name; });
    const edges = (characters.edges || []).map(e => ({
      ...e,
      sourceName: nodeMap[e.source] || e.source,
      targetName: nodeMap[e.target] || e.target,
    }));
    return { nodes: characters.nodes, edges };
  },

  _processTimelines(timelines) {
    if (!Array.isArray(timelines) || !timelines.length) return null;
    return timelines.map(t => ({
      ...t,
      importanceInfo: IMPORTANCE[t.importance] || IMPORTANCE.normal,
      displayTime:    t.time_display || formatTime(t.timestamp) || t.time || '',
      displayTitle:   t.title  || t.event  || '',
      displayContent: t.content || t.detail || '',
      isFuzzy:        t.time_type === 'fuzzy',
    }));
  },

  // 兼容旧数组格式和新 {nodes, edges} 图格式
  _processEvidence(evidence) {
    if (!evidence) return null;
    if (Array.isArray(evidence)) {
      return {
        nodes: evidence.map((e, idx) => ({
          id: String(idx + 1),
          name: e.title,
          type: 'physical',
          typeInfo: EVIDENCE_TYPES.physical,
          reliability: 'medium',
          reliabilityInfo: RELIABILITY.medium,
          description: e.desc,
          source: '',
          tags: e.tags || [],
        })),
        edges: [],
      };
    }
    if (!evidence.nodes) return null;
    const nodeMap = {};
    const nodes = evidence.nodes.map(n => {
      nodeMap[n.id] = n.name;
      return {
        ...n,
        typeInfo:        EVIDENCE_TYPES[n.type]       || { label: n.type || '证据', icon: '◉' },
        reliabilityInfo: RELIABILITY[n.reliability]   || { label: '?', className: 'rel-medium' },
      };
    });
    const edges = (evidence.edges || []).map(e => ({
      ...e,
      sourceName:    nodeMap[e.source] || e.source,
      targetName:    nodeMap[e.target] || e.target,
      relationLabel: RELATION_TYPE[e.relation_type] || e.relation_type,
    }));
    return { nodes, edges };
  },

  // ── 收藏 ──────────────────────────────────────────

  checkCollected(id) {
    app.request({
      url: `/user/collects/${id}/status`,
      success: (res) => {
        this.setData({ isCollected: !!(res.data && res.data.collected) });
      },
      fail: () => {},
    });
  },

  onCollect() {
    if (!app.requireLogin()) return;
    const { archiveId, isCollected } = this.data;
    app.request({
      url: `/user/collects/${archiveId}`,
      method: isCollected ? 'DELETE' : 'POST',
      success: () => {
        const next = !isCollected;
        this.setData({ isCollected: next });
        wx.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none' });
      },
    });
  },

  // ── 人物关系展开 ─────────────────────────────────

  onToggleCharEdge(e) {
    const idx = e.currentTarget.dataset.idx;
    const edge = this.data.archive.characters.edges[idx];
    if (!edge || !edge.interactions || edge.interactions.length === 0) return;
    this.setData({ expandedCharEdge: this.data.expandedCharEdge === idx ? null : idx });
  },

  // ── 评论 ──────────────────────────────────────────

  loadComments(id, reset = false) {
    if (reset) {
      this.setData({ comments: [], commentPage: 1, commentHasMore: true });
    }
    if (!this.data.commentHasMore && !reset) return;
    this.setData({ commentsLoading: true });
    app.request({
      url: `/archives/${id}/comments`,
      data: { page: this.data.commentPage, pageSize: 10 },
      success: (res) => {
        const list = (res.data.list || []).map((c) => ({
          ...c,
          createdAtFmt: formatTime(c.created_at),
        }));
        const newList = reset ? list : [...this.data.comments, ...list];
        this.setData({
          comments: newList,
          commentsLoading: false,
          commentHasMore: list.length === 10,
        });
      },
      fail: () => {
        this.setData({ commentsLoading: false });
      },
    });
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value });
  },

  onCommentSubmit() {
    if (!app.requireLogin()) return;
    const { commentText, archiveId } = this.data;
    if (!commentText.trim()) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }
    if (this.data.commentSubmitting) return;
    this.setData({ commentSubmitting: true });
    app.request({
      url: `/archives/${archiveId}/comments`,
      method: 'POST',
      data: { content: commentText.trim() },
      success: () => {
        this.setData({ commentText: '', commentSubmitting: false });
        wx.showToast({ title: '评论已发布', icon: 'none' });
        this.loadComments(archiveId, true);
      },
      fail: () => {
        this.setData({ commentSubmitting: false });
      },
    });
  },

  onLoadMoreComments() {
    if (!this.data.commentHasMore) return;
    this.setData({ commentPage: this.data.commentPage + 1 });
    this.loadComments(this.data.archiveId, false);
  },

  onUnload() {
    if (this._imgTimers) {
      Object.values(this._imgTimers).forEach(t => clearTimeout(t));
      this._imgTimers = {};
    }
  },

  // ── 举报 ──────────────────────────────────────────

  onReportTap() {
    if (!app.requireLogin()) return;
    const reasons = ['信息不实', '内容违规', '重复档案', '其他'];
    wx.showActionSheet({
      itemList: reasons,
      success: (res) => {
        const reason = reasons[res.tapIndex];
        app.request({
          url: `/archives/${this.data.archiveId}/report`,
          method: 'POST',
          data: { reason },
          success: () => {
            wx.showToast({ title: '举报已提交', icon: 'none' });
          },
        });
      },
    });
  },

  // ── 编辑 ──────────────────────────────────────────

  onEditTap() {
    wx.navigateTo({ url: `/pages/create/create?editId=${this.data.archiveId}` });
  },

  // ── 分享 ──────────────────────────────────────────

  onShare() {
    const { archive } = this.data;
    wx.shareAppMessage({
      title: archive ? `【閾界档案】${archive.title}` : '閾界档案室',
      path: `/pages/detail/detail?id=${archive ? archive.id : ''}`,
    });
  },

  onShareAppMessage() {
    const { archive } = this.data;
    return {
      title: archive ? `【閾界档案】${archive.title}` : '閾界档案室',
      path: `/pages/detail/detail?id=${archive ? archive.id : ''}`,
    };
  },

  // ── 证据关系图 ──────────────────────────────────────

  _getEvidenceLayout(count, W, H, nw, nh) {
    const cx = W / 2, cy = H / 2;
    if (count === 1) return [{ x: cx, y: cy }];
    if (count === 2) return [{ x: W * 0.25, y: cy }, { x: W * 0.75, y: cy }];

    // 保证相邻节点不重叠：rx >= (nw + gap) / (2 * sin(π/n))
    const minRx = (nw + 14) / (2 * Math.sin(Math.PI / count));
    const maxRx = W / 2 - nw / 2 - 8;
    const maxRy = H / 2 - nh / 2 - 8;
    const rx = Math.min(Math.max(minRx, W * 0.24), maxRx);
    const ry = Math.min(rx * (H / W) * 1.1, maxRy);

    return Array.from({ length: count }, (_, i) => {
      const angle = (2 * Math.PI * i / count) - Math.PI / 2;
      return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
    });
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  },

  _drawEvidenceNode(ctx, np, nw, nh, isSelected) {
    const { x, y, node } = np;
    const c = EV_COLORS[node.type] || EV_COLORS.physical;
    const lx = x - nw / 2, ty = y - nh / 2, r = 5;
    const dimmed = this._evSelectedId && !isSelected;
    ctx.globalAlpha = dimmed ? 0.35 : 1;

    // 背景（选中时加辉光）
    if (isSelected) {
      ctx.save();
      ctx.shadowColor = c.accent;
      ctx.shadowBlur = 14;
    }
    this._roundRect(ctx, lx, ty, nw, nh, r);
    ctx.fillStyle = c.fill;
    ctx.fill();
    if (isSelected) ctx.restore();

    // 边框
    this._roundRect(ctx, lx, ty, nw, nh, r);
    ctx.strokeStyle = isSelected ? c.accent : c.stroke;
    ctx.lineWidth = isSelected ? 1.5 : 1;
    ctx.stroke();

    // 可信度色条（节点顶部细线）
    const relColor = EV_REL_FILL[node.reliability] || '#556';
    this._roundRect(ctx, lx + 1, ty + 1, nw - 2, 3, 1);
    ctx.fillStyle = relColor;
    ctx.fill();

    // 类型图标
    ctx.fillStyle = c.accent;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText((EVIDENCE_TYPES[node.type] || { icon: '◉' }).icon, lx + 7, ty + 8);

    // 名称（居中，超长截断）
    const name = node.name.length > 9 ? node.name.substring(0, 8) + '…' : node.name;
    ctx.fillStyle = isSelected ? '#F0E8D8' : '#B8B0A0';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x, y + 5);

    ctx.globalAlpha = 1;
  },

  _drawEvidenceEdge(ctx, from, to, dimmed) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return null;
    const ux = dx / len, uy = dy / len;

    // 计算与矩形节点边框的交点
    const exitT = (hw, hh) => Math.min(
      Math.abs(ux) > 0.001 ? hw / Math.abs(ux) : Infinity,
      Math.abs(uy) > 0.001 ? hh / Math.abs(uy) : Infinity
    );
    const ts = exitT(from.hw, from.hh);
    const te = exitT(to.hw, to.hh);
    const sx = from.x + ux * (ts + 2), sy = from.y + uy * (ts + 2);
    // 箭头基部距边框 6px，箭尖恰好贴边框
    const ex = to.x - ux * (te + 6), ey = to.y - uy * (te + 6);
    const tipX = to.x - ux * te,     tipY = to.y - uy * te;

    ctx.globalAlpha = dimmed ? 0.18 : 0.88;

    // 虚线主体
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = '#5CBFA0';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 箭头
    const angle = Math.atan2(uy, ux);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - 8 * Math.cos(angle - 0.42), tipY - 8 * Math.sin(angle - 0.42));
    ctx.lineTo(tipX - 8 * Math.cos(angle + 0.42), tipY - 8 * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fillStyle = '#6DDFBF';
    ctx.fill();

    ctx.globalAlpha = 1;
    // 返回中点坐标供第三轮绘制标签
    return { mx: (sx + tipX) / 2, my: (sy + tipY) / 2 };
  },

  _drawEdgeLabel(ctx, x, y, label, dimmed) {
    ctx.globalAlpha = dimmed ? 0.25 : 1;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 14;
    this._roundRect(ctx, x - tw / 2, y - 8, tw, 16, 3);
    ctx.fillStyle = 'rgba(6,10,18,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(93,204,173,0.65)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = '#8dffdf';
    ctx.fillText(label, x, y);
    ctx.globalAlpha = 1;
  },

  // 力导向布局：将边标签互相推开，同时弹簧拉回各自所在边的中点
  _spreadEdgeLabels(labels, W, H) {
    if (labels.length <= 1) return labels.map(l => ({ ...l, x: l.mx, y: l.my }));

    const TH = 16, PAD = 8;
    const REPEL_R = 88;  // 斥力作用半径（px）
    const SPRING  = 0.07; // 弹簧系数（拉回原始中点）
    const DAMPING = 0.42; // 阻尼，避免震荡

    const pos = labels.map(l => ({
      x: l.mx, y: l.my,
      ox: l.mx, oy: l.my,
      tw: l.label.length * 7 + 14, // 估算宽度，与 measureText 近似
      label: l.label,
      dimmed: l.dimmed,
    }));

    for (let iter = 0; iter < 160; iter++) {
      for (let i = 0; i < pos.length; i++) {
        let fx = 0, fy = 0;

        // 斥力：距离越近推得越猛
        for (let j = 0; j < pos.length; j++) {
          if (i === j) continue;
          const dx = pos[i].x - pos[j].x;
          const dy = pos[i].y - pos[j].y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (d < REPEL_R) {
            const f = Math.pow((REPEL_R - d) / REPEL_R, 1.5) * 22 / d;
            fx += dx * f;
            fy += dy * f;
          }
        }

        // 弹簧：向原始中点回拉
        fx += (pos[i].ox - pos[i].x) * SPRING;
        fy += (pos[i].oy - pos[i].y) * SPRING;

        pos[i].x += fx * DAMPING;
        pos[i].y += fy * DAMPING;

        // 限制在画布内
        pos[i].x = Math.max(pos[i].tw / 2 + PAD, Math.min(W - pos[i].tw / 2 - PAD, pos[i].x));
        pos[i].y = Math.max(TH / 2 + PAD, Math.min(H - TH / 2 - PAD, pos[i].y));
      }
    }
    return pos;
  },

  _drawEvidenceGraph(selectedId) {
    const { archive } = this.data;
    if (!archive || !archive.evidence) return;
    const ev = archive.evidence;
    if (!ev.nodes || ev.nodes.length === 0) return;
    this._evSelectedId = selectedId || null;

    wx.createSelectorQuery().in(this)
      .select('#evidence-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const W = res[0].width, H = res[0].height;
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio)
          || wx.getSystemInfoSync().pixelRatio || 2;
        canvas.width  = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const count = ev.nodes.length;
        // 节点越多宽度越小，防止相互重叠
        const nw = count <= 3 ? Math.min(W * 0.29, 106)
                 : count <= 5 ? Math.min(W * 0.23, 86)
                 :               Math.min(W * 0.19, 70);
        const nh = 52;
        const layout = this._getEvidenceLayout(count, W, H, nw, nh);
        const nodePos = layout.map((p, i) => ({
          x: p.x, y: p.y, hw: nw / 2, hh: nh / 2, node: ev.nodes[i],
        }));
        const posMap = {};
        nodePos.forEach(np => { posMap[np.node.id] = np; });
        this._evNodePositions = nodePos;

        // 背景
        ctx.fillStyle = '#090D13';
        ctx.fillRect(0, 0, W, H);
        // 点阵纹理
        ctx.fillStyle = '#19283A';
        for (let gx = 14; gx < W; gx += 22) {
          for (let gy = 14; gy < H; gy += 22) {
            ctx.fillRect(gx, gy, 1, 1);
          }
        }

        // 第一轮：画边线 + 箭头（不含标签）
        const labelsToDraw = [];
        ev.edges.forEach(edge => {
          const from = posMap[edge.source], to = posMap[edge.target];
          if (!from || !to) return;
          const edgeDimmed = !!(selectedId && selectedId !== edge.source && selectedId !== edge.target);
          const lp = this._drawEvidenceEdge(ctx, from, to, edgeDimmed);
          if (lp && edge.relationLabel) {
            labelsToDraw.push({ mx: lp.mx, my: lp.my, label: edge.relationLabel, dimmed: edgeDimmed });
          }
        });

        // 第二轮：画节点（压住线的端点）
        nodePos.forEach(np => {
          this._drawEvidenceNode(ctx, np, nw, nh, np.node.id === selectedId);
        });

        // 第三轮：力导向展开标签后，画引导线 + 标签（浮于节点之上）
        const spreadLabels = this._spreadEdgeLabels(labelsToDraw, W, H);
        // 先画引导线（在标签背景之下）
        spreadLabels.forEach(lbl => {
          const dx = lbl.x - lbl.ox, dy = lbl.y - lbl.oy;
          if (dx * dx + dy * dy < 64) return; // 偏移不足 8px 就不画
          ctx.globalAlpha = lbl.dimmed ? 0.1 : 0.28;
          ctx.beginPath();
          ctx.moveTo(lbl.ox, lbl.oy);
          ctx.lineTo(lbl.x, lbl.y);
          ctx.strokeStyle = '#5CBFA0';
          ctx.lineWidth = 0.7;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        });
        // 再画标签本体
        spreadLabels.forEach(({ x, y, label, dimmed }) => {
          this._drawEdgeLabel(ctx, x, y, label, dimmed);
        });
      });
  },

  onEvidenceCanvasTouchStart(e) {
    // bindtouchstart 的 e.touches[0].x/y 是 canvas 本地坐标
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    const tapX = touch.x, tapY = touch.y;
    const positions = this._evNodePositions;
    if (!positions) return;
    let hit = null;
    for (const np of positions) {
      if (Math.abs(tapX - np.x) <= np.hw + 8 && Math.abs(tapY - np.y) <= np.hh + 8) {
        hit = np.node;
        break;
      }
    }
    const same = hit && this.data.evidenceSelectedNode && hit.id === this.data.evidenceSelectedNode.id;
    const selected = same ? null : hit;
    this.setData({ evidenceSelectedNode: selected });
    this._drawEvidenceGraph(selected ? selected.id : null);
  },

  onEvidenceDetailClose() {
    this.setData({ evidenceSelectedNode: null });
    this._drawEvidenceGraph(null);
  },

  // ── 参考链接 ─────────────────────────────────────

  onRefTap(e) {
    const url = e.currentTarget.dataset.url;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'none' }),
    });
  },

  // ── Mock 数据 ─────────────────────────────────────

  loadMockDetail(id) {
    const mock = {
      id: parseInt(id) || 1,
      title: '广州某居民楼的集体失忆事件',
      type: 0, status: 0, lang: 0,
      tags: ['丢失失踪', '极低概率事件'],
      content: `## 事件概述\n\n2019年3月14日凌晨2时至5时，广东省广州市荔湾区某居民楼内，共有**17名居民**在事后报告出现持续约3小时的完整记忆空白。\n\n## 初步调查\n\n当日凌晨，楼栋物业监控系统发生未知故障，时间戳显示画面冻结于 \`01:58:32\`，直至 \`05:03:17\` 恢复。相邻路段5组交通信号灯同时出现无规律闪烁，持续约40分钟。\n\n> 目前状态：该事件已引起地方性关注，正在进行深入调查中。官方暂未发布正式说明。`,
      characters: {
        nodes: [
          { id: 'u1', name: '张女士', role: '主要证人', tags: ['楼栋住户'], description: '最早向媒体反映该事件的居民。' },
          { id: 'u2', name: '物业管理员李某', role: '相关人员', tags: ['夜班值守'], description: '负责该楼栋的夜班物业，本人也报告有记忆空白。' },
        ],
        edges: [
          {
            source: 'u2', target: 'u1', base_relation: '同楼居民',
            interactions: [{ action: '核实事件', timestamp: '2019-03-14T08:00:00+08:00', detail: '物业向张女士询问当晚情况，两人陈述高度吻合。' }],
          },
        ],
      },
      timelines: [
        { id: 't1', time_type: 'precise', time_display: '2019-03-14 01:58', title: '监控系统画面冻结', content: '楼栋全部监控摄像头同时停止记录。', importance: 'critical', tags: ['监控异常'] },
        { id: 't2', time_type: 'fuzzy',   time_display: '2019-03-14 约02:00', title: '记忆空白期开始', content: '根据17名居民事后描述推断。', importance: 'high', tags: ['失忆'] },
        { id: 't3', time_type: 'precise', time_display: '2019-03-14 05:03', title: '监控恢复 / 居民苏醒', content: '监控时间戳重新同步，居民陆续恢复意识。', importance: 'critical', tags: ['监控异常'] },
      ],
      evidence: {
        nodes: [
          { id: 'e1', name: '监控时间戳异常截图', type: 'video', reliability: 'high', description: '显示冻结时间与恢复时间，时间差精确为3小时4分45秒。', source: '楼栋监控系统' },
          { id: 'e2', name: '17份居民证词', type: 'testimonial', reliability: 'high', description: '内容高度一致，均指向相同时间段的记忆缺失。', source: '警方调查笔录' },
        ],
        edges: [
          { source: 'e1', target: 'e2', relation_type: 'corroborates', description: '监控冻结时段与居民描述的失忆时段完全吻合。' },
        ],
      },
      ref_links: [
        { title: '南方都市报相关报道（存档）', url: 'https://example.com/nanfang-report' },
      ],
      location_desc: '广东省广州市荔湾区',
      occurredAt: '2019-03-14T02:00:00Z',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2024-03-01T00:00:00Z',
      closedAt: null, is_private: 0, view_count: 1024,
      author_id: 1,
      author: { id: 1, nick_name: '匿名调查员', avatar_url: '', level: 3 },
    };
    const processed = processArchive(mock);
    const archive = {
      ...processed,
      characters: this._processCharacters(processed.characters),
      timelines:  this._processTimelines(processed.timelines),
      evidence:   this._processEvidence(processed.evidence),
    };
    const userInfo = app.globalData.userInfo;
    const isAuthor = !!(userInfo && userInfo.id === mock.author_id);
    this.setData({ archive, isAuthor });
    this._processContent(processed.content);
    wx.setNavigationBarTitle({ title: processed.title });
    if (archive.evidence && archive.evidence.nodes && archive.evidence.nodes.length > 0) {
      setTimeout(() => this._drawEvidenceGraph(), 100);
    }
  },
});
