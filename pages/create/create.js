// pages/create/create.js
const app = getApp();

const CUSTOM_TAGS_KEY  = 'lia_custom_tags';
const { saveDraft: _saveDraft, getDraftById, deleteDraft } = require('../../utils/draft');

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const SECONDS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const TIME_RANGES = [HOURS, MINUTES, SECONDS];

function parseTimeValues(timeStr) {
  if (!timeStr) return [0, 0, 0];
  const p = timeStr.split(':');
  return [parseInt(p[0]) || 0, parseInt(p[1]) || 0, parseInt(p[2]) || 0];
}

const PRESET_TAGS = [
  '丢失失踪', '外星人', '不明飞行物', '刑事案件',
  '道听途说', '真实案件', '证据确凿', '电子游戏世界异常',
  '请提高警惕', '荒诞误会', '极低概率事件', '灵魂鬼怪',
];

const EVIDENCE_TYPE_OPTIONS = ['实物证据', '文件证据', '证人证词', '影像证据', '音频证据'];
const EVIDENCE_TYPE_VALUES  = ['physical', 'documentary', 'testimonial', 'video', 'audio'];
const RELIABILITY_OPTIONS   = ['高', '中', '低'];
const RELIABILITY_VALUES    = ['high', 'medium', 'low'];
const IMPORTANCE_OPTIONS    = ['普通', '重要', '关键'];
const IMPORTANCE_VALUES     = ['normal', 'high', 'critical'];

function buildOccurredAt(date, time) {
  if (!date) return null;
  return `${date}T${time || '00:00:00'}+08:00`;
}

Page({
  data: {
    title: '',
    content: '',
    typeIndex: 0,
    langIndex: 0,
    location_desc: '',
    occurred_date: '',
    occurred_time: '',
    timeRanges: TIME_RANGES,
    timeValues: [0, 0, 0],
    is_private: false,

    // 标签：allTags = 预置 + 自定义；customTagsMap 用于判断哪些可以删除
    allTags: [...PRESET_TAGS],
    customTags: [],
    customTagsMap: {},
    tags: [],
    tagsMap: {},
    customTagInput: '',

    // 人物节点 + 关系边
    characters: [],
    charNameOptions: [],
    char_edges: [],

    // 时间线
    timelines: [],

    // 参考链接
    ref_links: [],

    // 证据节点
    evidence_nodes: [],

    // Picker 选项（只读）
    typeOptions:         ['民间档案', '官方档案', '第三方档案'],
    statusOptions:       ['未结案', '已结案'],
    statusIndex:         0,
    langOptions:         ['中文', 'English'],
    evidenceTypeOptions: EVIDENCE_TYPE_OPTIONS,
    reliabilityOptions:  RELIABILITY_OPTIONS,
    importanceOptions:   IMPORTANCE_OPTIONS,

    showAdvanced: false,
    submitting: false,
    editId: null,
    draftId: null,
    contentCursor: -1,   // textarea 游标位置，-1 表示末尾
    imageUploading: false,
  },

  onLoad(options) {
    if (!app.requireLogin()) return;
    this._loadCustomTags();
    if (options.editId) {
      this.setData({ editId: options.editId });
      wx.setNavigationBarTitle({ title: '修改档案' });
      this._loadEditData(options.editId);
    } else if (options.draftId) {
      this.setData({ draftId: options.draftId });
      wx.setNavigationBarTitle({ title: '编辑草稿' });
      this._loadDraftData(options.draftId);
    }
  },

  // ── 自定义标签持久化 ──────────────────────────────

  _loadCustomTags() {
    const saved = wx.getStorageSync(CUSTOM_TAGS_KEY) || [];
    const customTagsMap = {};
    saved.forEach(t => { customTagsMap[t] = true; });
    this.setData({
      customTags:    saved,
      customTagsMap,
      allTags:       [...PRESET_TAGS, ...saved],
    });
  },

  // ── 编辑模式：加载已有档案 ────────────────────────

  _loadEditData(id) {
    app.request({
      url: `/archives/${id}`,
      success: (res) => {
        const a = res.data;
        if (!a) return;

        // 解析 occurred_at → occurred_date + occurred_time
        let occurred_date = '', occurred_time = '';
        const oa = a.occurred_at || a.occurredAt;
        if (oa) {
          const raw = typeof oa === 'object' ? oa.dateTime : oa;
          const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(raw || '');
          if (m) { occurred_date = m[1]; occurred_time = m[2]; }
        }

        // type / status / lang 映射（字符串枚举 → index）
        const TYPE_MAP    = { FOLK: 0, OFFICIAL: 1, THIRD: 2, 0: 0, 1: 1, 2: 2 };
        const STATUS_MAP  = { UPDATING: 0, CLOSED: 1, 0: 0, 1: 1 };
        const LANG_MAP    = { SCHINESE: 0, ENGLISH: 1, 0: 0, 1: 1 };
        const typeIndex   = TYPE_MAP[a.type]    != null ? TYPE_MAP[a.type]    : 0;
        const statusIndex = STATUS_MAP[a.status] != null ? STATUS_MAP[a.status] : 0;
        const langIndex   = LANG_MAP[a.lang]    != null ? LANG_MAP[a.lang]    : 0;

        const tags = a.tags || [];
        const chars = (a.characters && a.characters.nodes) ? a.characters.nodes.map(n => ({
          name: n.name, role: n.role || '', description: n.description || '',
        })) : [];

        this.setData({
          title:         a.title         || '',
          content:       a.content       || '',
          typeIndex,
          statusIndex,
          langIndex,
          location_desc: a.location_desc || a.locationDesc || '',
          occurred_date,
          occurred_time,
          timeValues:    parseTimeValues(occurred_time),
          is_private:    !!(a.is_private || a.isPrivate),
          tags,
          tagsMap:       this._buildTagsMap(tags),
          characters:    chars,
          charNameOptions: chars.map((c, i) => c.name || `人物 ${i + 1}`),
          timelines:     (a.timelines || []).map(t => ({
            time_display:   t.time_display || '',
            title:          t.title        || '',
            content:        t.content      || '',
            is_fuzzy:       t.time_type === 'fuzzy',
            importance_index: IMPORTANCE_VALUES.indexOf(t.importance) > -1
              ? IMPORTANCE_VALUES.indexOf(t.importance) : 0,
          })),
          ref_links:     a.ref_links || [],
          evidence_nodes: ((a.evidence && a.evidence.nodes) || []).map(n => ({
            name:              n.name        || '',
            description:       n.description || '',
            source:            n.source      || '',
            type_index:        EVIDENCE_TYPE_VALUES.indexOf(n.type) > -1
              ? EVIDENCE_TYPE_VALUES.indexOf(n.type) : 0,
            reliability_index: RELIABILITY_VALUES.indexOf(n.reliability) > -1
              ? RELIABILITY_VALUES.indexOf(n.reliability) : 1,
          })),
        });
      },
    });
  },

  // ── 草稿 ──────────────────────────────────────────

  _buildTagsMap(tags) {
    const m = {};
    (tags || []).forEach(t => { m[t] = true; });
    return m;
  },

  _loadDraftData(draftId) {
    const draft = getDraftById(draftId);
    if (!draft) {
      wx.showToast({ title: '草稿不存在', icon: 'none' });
      return;
    }
    const tags  = draft.tags       || [];
    const chars = draft.characters || [];
    this.setData({
      title:           draft.title          || '',
      content:         draft.content        || '',
      typeIndex:       draft.typeIndex      || 0,
      statusIndex:     draft.statusIndex    || 0,
      langIndex:       draft.langIndex      || 0,
      location_desc:   draft.location_desc  || '',
      occurred_date:   draft.occurred_date  || '',
      occurred_time:   draft.occurred_time  || '',
      timeValues:      parseTimeValues(draft.occurred_time),
      is_private:      draft.is_private     || false,
      tags,
      tagsMap:         this._buildTagsMap(tags),
      characters:      chars,
      charNameOptions: chars.map((c, i) => c.name || `人物 ${i + 1}`),
      char_edges:      draft.char_edges     || [],
      timelines:       draft.timelines      || [],
      ref_links:       draft.ref_links      || [],
      evidence_nodes:  draft.evidence_nodes || [],
    });
  },

  saveDraft() {
    const d = this.data;
    const id = d.draftId || ('draft_' + Date.now());
    _saveDraft(id, {
      title:          d.title,         content:        d.content,
      typeIndex:      d.typeIndex,     statusIndex:    d.statusIndex,
      langIndex:      d.langIndex,     location_desc:  d.location_desc,
      occurred_date:  d.occurred_date, occurred_time:  d.occurred_time,
      is_private:     d.is_private,    tags:           d.tags,
      characters:     d.characters,   char_edges:     d.char_edges,
      timelines:      d.timelines,     ref_links:      d.ref_links,
      evidence_nodes: d.evidence_nodes,
    });
    if (!d.draftId) this.setData({ draftId: id });
    wx.showToast({ title: '草稿已保存', icon: 'none' });
  },

  // ── 图片上传 ──────────────────────────────────────

  onInsertImage() {
    if (this.data.imageUploading) return;
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: (chooseRes) => {
        const tempPath = chooseRes.tempFilePaths[0];
        this.setData({ imageUploading: true });
        // 压缩到 quality 20（尽可能低）
        wx.compressImage({
          src: tempPath,
          quality: 20,
          success: (compressRes) => {
            this._uploadImageFile(compressRes.tempFilePath);
          },
          fail: () => {
            // 压缩失败则使用原图
            this._uploadImageFile(tempPath);
          },
        });
      },
    });
  },

  _uploadImageFile(filePath) {
    const { token, baseUrl } = app.globalData;
    wx.uploadFile({
      url: `${baseUrl}/upload/image`,
      filePath,
      name: 'image',
      header: { Authorization: `Bearer ${token}` },
      success: (uploadRes) => {
        this.setData({ imageUploading: false });
        if (uploadRes.statusCode !== 200 && uploadRes.statusCode !== 201) {
          wx.showToast({ title: '上传失败', icon: 'none' });
          return;
        }
        let body;
        try { body = JSON.parse(uploadRes.data); } catch (e) {
          wx.showToast({ title: '上传响应解析失败', icon: 'none' });
          return;
        }
        if (body.code >= 300) {
          wx.showToast({ title: body.message || '上传失败', icon: 'none' });
          return;
        }
        this._insertAtCursor(`![](${body.data})`);
      },
      fail: () => {
        this.setData({ imageUploading: false });
        wx.showToast({ title: '上传失败，请检查网络', icon: 'none' });
      },
    });
  },

  // 在当前游标位置插入文本，保持换行对齐
  _insertAtCursor(text) {
    const content = this.data.content;
    const cursor = this.data.contentCursor;
    const pos = (cursor < 0 || cursor > content.length) ? content.length : cursor;
    const before = content.slice(0, pos);
    const after  = content.slice(pos);
    const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const suffix = after.length  > 0 && !after.startsWith('\n') ? '\n' : '';
    const insert = prefix + text + suffix;
    const newContent = before + insert + after;
    const newCursor  = pos + insert.length;
    this.setData({ content: newContent, contentCursor: newCursor });
  },

  // ── 基础字段 ─────────────────────────────────────

  onTitleInput(e)    { this.setData({ title: e.detail.value }); },
  onContentInput(e)  { this.setData({ content: e.detail.value, contentCursor: e.detail.cursor }); },
  onContentFocus(e)  { this.setData({ contentCursor: e.detail.cursor }); },
  onLocationInput(e) { this.setData({ location_desc: e.detail.value }); },
  onTypeChange(e)   { this.setData({ typeIndex:   parseInt(e.detail.value) }); },
  onStatusChange(e) { this.setData({ statusIndex: parseInt(e.detail.value) }); },
  onLangChange(e)    { this.setData({ langIndex: parseInt(e.detail.value) }); },
  onDateChange(e) { this.setData({ occurred_date: e.detail.value }); },

  onTimeChange(e) {
    const [h, m, s] = e.detail.value;
    this.setData({
      timeValues:    e.detail.value,
      occurred_time: `${HOURS[h]}:${MINUTES[m]}:${SECONDS[s]}`,
    });
  },

  onTimeClear() {
    this.setData({ occurred_time: '', timeValues: [0, 0, 0] });
  },
  onPrivateChange(e) { this.setData({ is_private: e.detail.value }); },
  onToggleAdvanced() { this.setData({ showAdvanced: !this.data.showAdvanced }); },

  // ── 标签 ─────────────────────────────────────────

  onTagToggle(e) {
    const tag    = e.currentTarget.dataset.tag;
    const tagsMap = { ...this.data.tagsMap };
    const tags    = [...this.data.tags];
    if (tagsMap[tag]) {
      delete tagsMap[tag];
      tags.splice(tags.indexOf(tag), 1);
    } else {
      tagsMap[tag] = true;
      tags.push(tag);
    }
    this.setData({ tagsMap, tags });
  },

  onCustomTagInput(e) {
    this.setData({ customTagInput: e.detail.value });
  },

  onAddCustomTag() {
    const raw = (this.data.customTagInput || '').trim();
    if (!raw) return;

    const allTags      = [...this.data.allTags];
    const customTags   = [...this.data.customTags];
    const customTagsMap = { ...this.data.customTagsMap };
    const tagsMap      = { ...this.data.tagsMap };
    const tags         = [...this.data.tags];

    if (!allTags.includes(raw)) {
      allTags.push(raw);
      customTags.push(raw);
      customTagsMap[raw] = true;
      wx.setStorageSync(CUSTOM_TAGS_KEY, customTags);
    }
    if (!tagsMap[raw]) {
      tagsMap[raw] = true;
      tags.push(raw);
    }
    this.setData({ allTags, customTags, customTagsMap, tagsMap, tags, customTagInput: '' });
  },

  onDeleteCustomTag(e) {
    const tag          = e.currentTarget.dataset.tag;
    const customTags   = this.data.customTags.filter(t => t !== tag);
    const allTags      = this.data.allTags.filter(t => t !== tag);
    const customTagsMap = { ...this.data.customTagsMap };
    delete customTagsMap[tag];
    const tagsMap = { ...this.data.tagsMap };
    delete tagsMap[tag];
    const tags = this.data.tags.filter(t => t !== tag);
    wx.setStorageSync(CUSTOM_TAGS_KEY, customTags);
    this.setData({ customTags, allTags, customTagsMap, tagsMap, tags });
  },

  onRemoveSelectedTag(e) {
    const tag    = e.currentTarget.dataset.tag;
    const tagsMap = { ...this.data.tagsMap };
    delete tagsMap[tag];
    this.setData({ tagsMap, tags: this.data.tags.filter(t => t !== tag) });
  },

  // ── 人物节点 ─────────────────────────────────────

  _syncCharOptions() {
    const charNameOptions = this.data.characters.map((c, i) => c.name || `人物 ${i + 1}`);
    this.setData({ charNameOptions });
  },

  onAddCharacter() {
    const characters = [...this.data.characters, { name: '', role: '', description: '' }];
    this.setData({ characters }, () => this._syncCharOptions());
  },

  onCharNameInput(e) {
    const { index } = e.currentTarget.dataset;
    const characters = [...this.data.characters];
    characters[index].name = e.detail.value;
    this.setData({ characters }, () => this._syncCharOptions());
  },

  onCharRoleInput(e) {
    const { index } = e.currentTarget.dataset;
    const characters = [...this.data.characters];
    characters[index].role = e.detail.value;
    this.setData({ characters });
  },

  onCharDescInput(e) {
    const { index } = e.currentTarget.dataset;
    const characters = [...this.data.characters];
    characters[index].description = e.detail.value;
    this.setData({ characters });
  },

  onRemoveCharacter(e) {
    const { index } = e.currentTarget.dataset;
    const characters = this.data.characters.filter((_, i) => i !== index);
    const char_edges = this.data.char_edges.filter(
      edge => edge.source_idx !== index && edge.target_idx !== index
    ).map(edge => ({
      ...edge,
      source_idx: edge.source_idx > index ? edge.source_idx - 1 : edge.source_idx,
      target_idx: edge.target_idx > index ? edge.target_idx - 1 : edge.target_idx,
    }));
    this.setData({ characters, char_edges }, () => this._syncCharOptions());
  },

  // ── 关系链（人物边）─────────────────────────────

  onAddCharEdge() {
    if (this.data.characters.length < 2) {
      wx.showToast({ title: '请先添加至少2名人物', icon: 'none' });
      return;
    }
    const char_edges = [...this.data.char_edges, {
      source_idx: 0, target_idx: 1,
      base_relation: '', interactions: [],
    }];
    this.setData({ char_edges });
  },

  onRemoveCharEdge(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ char_edges: this.data.char_edges.filter((_, i) => i !== index) });
  },

  onEdgeSourceChange(e) {
    const { index } = e.currentTarget.dataset;
    const char_edges = [...this.data.char_edges];
    char_edges[index].source_idx = parseInt(e.detail.value);
    this.setData({ char_edges });
  },

  onEdgeTargetChange(e) {
    const { index } = e.currentTarget.dataset;
    const char_edges = [...this.data.char_edges];
    char_edges[index].target_idx = parseInt(e.detail.value);
    this.setData({ char_edges });
  },

  onEdgeRelationInput(e) {
    const { index } = e.currentTarget.dataset;
    const char_edges = [...this.data.char_edges];
    char_edges[index].base_relation = e.detail.value;
    this.setData({ char_edges });
  },

  onAddInteraction(e) {
    const edgeIdx    = e.currentTarget.dataset.edgeIdx;
    const char_edges = [...this.data.char_edges];
    char_edges[edgeIdx].interactions = [
      ...char_edges[edgeIdx].interactions,
      { action: '', detail: '' },
    ];
    this.setData({ char_edges });
  },

  onRemoveInteraction(e) {
    const { edgeIdx, iaIdx } = e.currentTarget.dataset;
    const char_edges = [...this.data.char_edges];
    char_edges[edgeIdx].interactions = char_edges[edgeIdx].interactions.filter((_, i) => i !== iaIdx);
    this.setData({ char_edges });
  },

  onIaActionInput(e) {
    const { edgeIdx, iaIdx } = e.currentTarget.dataset;
    const char_edges = [...this.data.char_edges];
    char_edges[edgeIdx].interactions[iaIdx].action = e.detail.value;
    this.setData({ char_edges });
  },

  onIaDetailInput(e) {
    const { edgeIdx, iaIdx } = e.currentTarget.dataset;
    const char_edges = [...this.data.char_edges];
    char_edges[edgeIdx].interactions[iaIdx].detail = e.detail.value;
    this.setData({ char_edges });
  },

  // ── 时间线 ───────────────────────────────────────

  onAddTimeline() {
    const timelines = [...this.data.timelines, {
      time_display: '', title: '', content: '',
      importance_index: 0, is_fuzzy: false,
    }];
    this.setData({ timelines });
  },

  onTlTimeInput(e) {
    const { index } = e.currentTarget.dataset;
    const timelines = [...this.data.timelines];
    timelines[index].time_display = e.detail.value;
    this.setData({ timelines });
  },

  onTlTitleInput(e) {
    const { index } = e.currentTarget.dataset;
    const timelines = [...this.data.timelines];
    timelines[index].title = e.detail.value;
    this.setData({ timelines });
  },

  onTlContentInput(e) {
    const { index } = e.currentTarget.dataset;
    const timelines = [...this.data.timelines];
    timelines[index].content = e.detail.value;
    this.setData({ timelines });
  },

  onTlImportanceChange(e) {
    const { index } = e.currentTarget.dataset;
    const timelines = [...this.data.timelines];
    timelines[index].importance_index = parseInt(e.detail.value);
    this.setData({ timelines });
  },

  onTlFuzzyChange(e) {
    const { index } = e.currentTarget.dataset;
    const timelines = [...this.data.timelines];
    timelines[index].is_fuzzy = e.detail.value;
    this.setData({ timelines });
  },

  onRemoveTimeline(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ timelines: this.data.timelines.filter((_, i) => i !== index) });
  },

  // ── 参考链接 ─────────────────────────────────────

  onAddRefLink() {
    this.setData({ ref_links: [...this.data.ref_links, { title: '', url: '' }] });
  },

  onRefLinkTitleInput(e) {
    const { index } = e.currentTarget.dataset;
    const ref_links = [...this.data.ref_links];
    ref_links[index].title = e.detail.value;
    this.setData({ ref_links });
  },

  onRefLinkUrlInput(e) {
    const { index } = e.currentTarget.dataset;
    const ref_links = [...this.data.ref_links];
    ref_links[index].url = e.detail.value;
    this.setData({ ref_links });
  },

  onRemoveRefLink(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ ref_links: this.data.ref_links.filter((_, i) => i !== index) });
  },

  // ── 证据节点 ─────────────────────────────────────

  onAddEvidenceNode() {
    const evidence_nodes = [...this.data.evidence_nodes, {
      name: '', type_index: 0, reliability_index: 1,
      description: '', source: '',
    }];
    this.setData({ evidence_nodes });
  },

  onEvNameInput(e) {
    const { index } = e.currentTarget.dataset;
    const evidence_nodes = [...this.data.evidence_nodes];
    evidence_nodes[index].name = e.detail.value;
    this.setData({ evidence_nodes });
  },

  onEvTypeChange(e) {
    const { index } = e.currentTarget.dataset;
    const evidence_nodes = [...this.data.evidence_nodes];
    evidence_nodes[index].type_index = parseInt(e.detail.value);
    this.setData({ evidence_nodes });
  },

  onEvReliabilityChange(e) {
    const { index } = e.currentTarget.dataset;
    const evidence_nodes = [...this.data.evidence_nodes];
    evidence_nodes[index].reliability_index = parseInt(e.detail.value);
    this.setData({ evidence_nodes });
  },

  onEvDescInput(e) {
    const { index } = e.currentTarget.dataset;
    const evidence_nodes = [...this.data.evidence_nodes];
    evidence_nodes[index].description = e.detail.value;
    this.setData({ evidence_nodes });
  },

  onEvSourceInput(e) {
    const { index } = e.currentTarget.dataset;
    const evidence_nodes = [...this.data.evidence_nodes];
    evidence_nodes[index].source = e.detail.value;
    this.setData({ evidence_nodes });
  },

  onRemoveEvidenceNode(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ evidence_nodes: this.data.evidence_nodes.filter((_, i) => i !== index) });
  },

  // ── 提交 ─────────────────────────────────────────

  onSubmit() {
    if (!app.requireLogin()) return;
    if (this.data.submitting) return;
    const { title, content } = this.data;
    if (!title.trim()) { wx.showToast({ title: '请填写档案标题', icon: 'none' }); return; }
    if (!content.trim()) { wx.showToast({ title: '请填写事件正文', icon: 'none' }); return; }

    const d = this.data;

    const characters = d.characters.length ? {
      nodes: d.characters.map((c, i) => ({
        id: `u${i + 1}`, name: c.name, role: c.role, description: c.description, tags: [],
      })),
      edges: d.char_edges.map(e => ({
        source: `u${e.source_idx + 1}`,
        target: `u${e.target_idx + 1}`,
        base_relation: e.base_relation,
        interactions: e.interactions.map(ia => ({
          action: ia.action, timestamp: null, detail: ia.detail,
        })),
      })),
    } : null;

    const timelines = d.timelines.length ? d.timelines.map((t, i) => ({
      id: `t${i + 1}`,
      time_type:    t.is_fuzzy ? 'fuzzy' : 'precise',
      time_display: t.time_display,
      timestamp:    null,
      title:        t.title,
      content:      t.content,
      importance:   IMPORTANCE_VALUES[t.importance_index] || 'normal',
      related_characters: [], tags: [],
    })) : null;

    const evidence = d.evidence_nodes.length ? {
      nodes: d.evidence_nodes.map((n, i) => ({
        id: `e${i + 1}`,
        name:        n.name,
        type:        EVIDENCE_TYPE_VALUES[n.type_index]       || 'physical',
        reliability: RELIABILITY_VALUES[n.reliability_index]  || 'medium',
        description: n.description,
        source:      n.source,
        related_characters: [], related_timelines: [],
      })),
      edges: [],
    } : null;

    const payload = {
      title:        title.trim(),
      content:      content.trim(),
      type:         d.typeIndex,
      status:       d.statusIndex,
      lang:         d.langIndex,
      location_desc: d.location_desc.trim() || null,
      occurred_at:  buildOccurredAt(d.occurred_date, d.occurred_time),
      is_private:   d.is_private ? 1 : 0,
      tags:         d.tags.length       ? d.tags       : null,
      characters:   characters          || null,
      timelines:    timelines           || null,
      ref_links:    d.ref_links.length  ? d.ref_links  : null,
      evidence:     evidence            || null,
    };

    const { editId } = this.data;
    this.setData({ submitting: true });
    app.request({
      url: editId ? `/archives/${editId}` : '/archives',
      method: editId ? 'PATCH' : 'POST',
      data: payload,
      success: () => {
        this.setData({ submitting: false });
        const { draftId } = this.data;
        if (draftId) deleteDraft(draftId);
        app.globalData.contentUpdated = true;
        wx.showToast({ title: editId ? '档案已更新' : '档案已提交', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1000);
      },
      fail: () => { this.setData({ submitting: false }); },
    });
  },

  onSaveDraft() { this.saveDraft(); },

  onOpenDrafts() {
    wx.navigateTo({ url: '/pages/drafts/drafts' });
  },
});
