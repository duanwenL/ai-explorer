import { initializeDocumentViewer } from './document-viewer.js';

/** 浏览器只调用同源 Java 接口，不持有模型密钥。 */
export async function initializePage(root) {
  const uploadForm = root.getElementById('upload-form');
  const uploadButton = root.getElementById('upload-button');
  const fileInput = root.getElementById('document-file');
  const searchForm = root.getElementById('search-form');
  const searchButton = root.getElementById('search-button');
  const queryInput = root.getElementById('search-query');
  const topKInput = root.getElementById('top-k');
  const documentViewer = initializeDocumentViewer(root);
  let configuration = null;
  let uploading = false;
  let searching = false;

  uploadForm.addEventListener('submit', uploadDocument);
  searchForm.addEventListener('submit', searchDocuments);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    root.getElementById('selected-file').textContent = file ? `${file.name} · ${formatBytes(file.size)}` : '尚未选择文件';
  });
  root.getElementById('reload-config').addEventListener('click', loadConfiguration);
  root.getElementById('theme-button').addEventListener('click', () => {
    const dark = root.documentElement.dataset.theme !== 'dark';
    root.documentElement.dataset.theme = dark ? 'dark' : 'light';
    root.getElementById('theme-button').setAttribute('aria-pressed', String(dark));
    root.getElementById('theme-button').textContent = dark ? '切换浅色' : '切换深色';
  });
  if (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    root.documentElement.dataset.theme = 'dark';
    root.getElementById('theme-button').setAttribute('aria-pressed', 'true');
    root.getElementById('theme-button').textContent = '切换浅色';
  }
  await loadConfiguration();

  async function loadConfiguration() {
    root.getElementById('reload-config').hidden = true;
    setStatus(root.getElementById('config-status'), '正在读取运行配置…');
    try {
      const value = await requestJson('/api/config');
      if (!value.embeddingModel || !Number.isInteger(value.embeddingDimensions)
          || !Number.isInteger(value.chunkSize) || !Number.isInteger(value.chunkOverlap)
          || !Array.isArray(value.supportedExtensions) || !(value.maxFileBytes > 0)
          || !Number.isInteger(value.defaultTopK) || !Number.isInteger(value.maxTopK)
          || value.retrievalMode !== 'dense_bm25_rrf' || typeof value.rerankConfigured !== 'boolean') {
        throw new Error('服务端配置响应格式不正确');
      }
      configuration = value;
      root.getElementById('embedding-model').textContent = value.embeddingModel;
      root.getElementById('embedding-dimensions').textContent = String(value.embeddingDimensions);
      root.getElementById('chunk-size').textContent = String(value.chunkSize);
      root.getElementById('chunk-overlap').textContent = String(value.chunkOverlap);
      root.getElementById('embedding-batch-size').textContent = String(value.embeddingBatchSize);
      root.getElementById('max-file-size').textContent = formatBytes(value.maxFileBytes);
      root.getElementById('collection-name').textContent = value.collectionName;
      root.getElementById('retrieval-mode').textContent = '向量 + BM25 · RRF 融合';
      root.getElementById('rerank-config').textContent = value.rerankConfigured
        ? `已配置 ${value.rerankModel}，是否生效以每次检索结果为准`
        : '未启用，按 RRF 顺序返回，不调用重排 API';
      root.getElementById('processing-limits').textContent = `单次最多 ${value.maxChunks} 个片段；解析正文最多 ${value.maxTextCharacters.toLocaleString('zh-CN')} 个字符。`;
      root.getElementById('upload-help').textContent = `支持 ${value.supportedExtensions.join(' / ').toUpperCase()}，单文件最多 ${formatBytes(value.maxFileBytes)}`;
      fileInput.accept = value.supportedExtensions.map(extension => `.${extension}`).join(',');
      topKInput.value = String(value.defaultTopK);
      topKInput.max = String(value.maxTopK);
      fileInput.disabled = false;
      queryInput.disabled = false;
      topKInput.disabled = false;
      uploadButton.disabled = false;
      searchButton.disabled = false;
      setStatus(root.getElementById('config-status'), '配置已加载。向量 API 凭据仅在服务端使用。', 'success');
    } catch (error) {
      setStatus(root.getElementById('config-status'), `配置读取失败：${error.message}`, 'error');
      root.getElementById('reload-config').hidden = false;
    }
  }

  async function uploadDocument(event) {
    event.preventDefault();
    if (!configuration || uploading) return;
    const status = root.getElementById('upload-status');
    const file = fileInput.files[0];
    if (!file || file.size === 0) {
      setStatus(status, '请选择一份非空文件。', 'error');
      return;
    }
    const extension = file.name.split('.').pop().toLowerCase();
    if (!configuration.supportedExtensions.includes(extension)) {
      setStatus(status, '不支持这个文件格式，请选择 TXT、Markdown、DOCX 或文字型 PDF。', 'error');
      return;
    }
    if (file.size > configuration.maxFileBytes) {
      setStatus(status, `文件超过 ${formatBytes(configuration.maxFileBytes)}，请拆分后上传。`, 'error');
      return;
    }
    uploading = true;
    uploadButton.disabled = true;
    fileInput.disabled = true;
    uploadForm.setAttribute('aria-busy', 'true');
    uploadButton.textContent = '正在处理…';
    setStatus(status, '正在上传、解析和向量入库，请等待完成；大文档可能需要较长时间。');
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await requestJson('/api/documents', { method: 'POST', body });
      if (!result.documentId || !result.fileName || !Number.isInteger(result.chunkCount)) {
        throw new Error('服务端上传响应格式不正确，请检查入库状态后再决定是否重试。');
      }
      setStatus(status, `入库成功：${result.fileName}，${result.chunkCount} 个片段。可以开始检索了。`, 'success');
      const item = root.createElement('li');
      item.append(root.createTextNode(result.fileName));
      const details = root.createElement('small');
      details.textContent = `${result.chunkCount} 个片段 · 文档 ID：${result.documentId}`;
      item.append(details);
      const recent = root.getElementById('recent-uploads');
      recent.prepend(item);
      if (recent.children.length > 20) recent.lastElementChild.remove();
    } catch (error) {
      setStatus(status, `上传未确认完成：${error.message} 若网络中断，服务端可能仍在处理，请先检索核对，避免重复上传。`, 'error');
    } finally {
      uploading = false;
      uploadButton.disabled = false;
      fileInput.disabled = false;
      uploadForm.setAttribute('aria-busy', 'false');
      uploadButton.textContent = '上传并入库';
    }
  }

  async function searchDocuments(event) {
    event.preventDefault();
    if (!configuration || searching) return;
    const status = root.getElementById('search-status');
    const query = queryInput.value.trim();
    const topK = Number(topKInput.value);
    if (!query || query.length > 2000) {
      setStatus(status, '请输入 1 到 2000 个字符的问题。', 'error');
      return;
    }
    if (!Number.isInteger(topK) || topK < 1 || topK > configuration.maxTopK) {
      setStatus(status, `返回条数必须是 1 到 ${configuration.maxTopK} 的整数。`, 'error');
      return;
    }
    searching = true;
    searchButton.disabled = true;
    queryInput.disabled = true;
    topKInput.disabled = true;
    searchForm.setAttribute('aria-busy', 'true');
    searchButton.textContent = '检索中…';
    root.getElementById('search-results').replaceChildren();
    root.getElementById('results-empty').hidden = true;
    root.getElementById('results-count').textContent = '检索中…';
    setStatus(root.getElementById('ranking-status'), '正在进行向量与 BM25 召回…');
    setStatus(status, '正在将问题向量化并检索文档…');
    try {
      const result = await requestJson('/api/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, topK }),
      });
      if (!Array.isArray(result.results)) throw new Error('服务端检索响应格式不正确');
      renderResults(root, result.results, documentViewer);
      const rankingStatus = root.getElementById('ranking-status');
      if (result.rankingMode === 'rerank') {
        setStatus(rankingStatus, '重排已生效：正文按 0.5 门槛过滤，保留原始 RRF 分数供核对。', 'success');
      } else if (result.rankingMode === 'rrf_fallback') {
        setStatus(rankingStatus, '重排未生效，已退回 RRF 融合顺序；未使用 0.5 重排门槛。');
      } else if (result.rankingMode === 'rrf') {
        setStatus(rankingStatus, '本次按 RRF 融合顺序返回，未进行重排。', 'success');
      } else {
        setStatus(rankingStatus, '服务端未提供可识别的排序方式，请核对服务版本。', 'error');
      }
      setStatus(status, `检索完成，共 ${result.results.length} 个相关片段。${uploading ? '当前仍有文档正在入库，结果可能尚未包含全部新片段。' : ''}`, 'success');
    } catch (error) {
      setStatus(status, `检索失败：${error.message}`, 'error');
      setStatus(root.getElementById('ranking-status'), '本次检索未完成，暂无排序结果。', 'error');
      root.getElementById('results-count').textContent = '检索失败';
      const empty = root.getElementById('results-empty');
      empty.hidden = false;
      empty.textContent = '本次检索未完成，请根据错误提示检查配置或稍后重试。';
    } finally {
      searching = false;
      searchButton.disabled = false;
      queryInput.disabled = false;
      topKInput.disabled = false;
      searchForm.setAttribute('aria-busy', 'false');
      searchButton.textContent = '开始检索';
    }
  }
}

async function requestJson(path, options) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error('网络连接失败，请确认 Java 服务仍在运行。');
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`服务端未返回 JSON（HTTP ${response.status}），请检查服务或代理。`);
  }
  if (!response.ok) throw new Error(payload.message || `请求失败（HTTP ${response.status}）`);
  return payload;
}

function renderResults(root, results, documentViewer) {
  const container = root.getElementById('search-results');
  const empty = root.getElementById('results-empty');
  container.replaceChildren();
  root.getElementById('results-count').textContent = `${results.length} 个片段`;
  empty.hidden = results.length > 0;
  if (results.length === 0) {
    empty.textContent = '没有找到相关片段。请确认资料已成功入库，或换一个问题试试。';
    return;
  }
  results.forEach((hit, index) => {
    const card = root.createElement('article');
    card.className = 'result-card';
    const header = root.createElement('header');
    const title = root.createElement('h4');
    title.textContent = `${index + 1}. ${hit.fileName || '来源未提供'}`;
    const score = root.createElement('span');
    score.className = 'result-score';
    let scoreLabel = '排序分数';
    if (hit.scoreType === 'rrf') scoreLabel = 'RRF 融合分数';
    if (hit.scoreType === 'rerank') scoreLabel = '重排相关性';
    score.textContent = typeof hit.score === 'number' && Number.isFinite(hit.score) ? `${scoreLabel} ${hit.score.toFixed(4)}` : '分数未提供';
    const actions = root.createElement('div');
    actions.className = 'result-actions';
    const originalButton = root.createElement('button');
    originalButton.type = 'button';
    originalButton.className = 'button button-secondary view-document-button';
    originalButton.textContent = '查看原文';
    originalButton.setAttribute('aria-label', `查看 ${hit.fileName || '此文档'} 的完整原文`);
    originalButton.setAttribute('aria-haspopup', 'dialog');
    originalButton.setAttribute('aria-controls', 'document-dialog');
    originalButton.disabled = !/^[1-9][0-9]{0,18}$/.test(String(hit.documentId || ''));
    originalButton.addEventListener('click', () => documentViewer.open(hit, originalButton));
    actions.append(score, originalButton);
    header.append(title, actions);
    const metadata = root.createElement('p');
    metadata.className = 'result-meta';
    const chunk = Number.isInteger(hit.chunkIndex) ? hit.chunkIndex + 1 : '未知';
    const source = [`片段 ${chunk}`, `文档 ID：${hit.documentId || '未提供'}`, `片段 ID：${hit.chunkId || '未提供'}`];
    if (hit.headingPath) source.push(`标题：${hit.headingPath}`);
    if (Number.isInteger(hit.anchor?.lineStart) && Number.isInteger(hit.anchor?.lineEnd)) {
      source.push(`提取文本第 ${hit.anchor.lineStart}–${hit.anchor.lineEnd} 行`);
    }
    if (hit.scoreType === 'rerank' && typeof hit.rrfScore === 'number' && Number.isFinite(hit.rrfScore)) {
      source.push(`原始 RRF ${hit.rrfScore.toFixed(4)}`);
    }
    metadata.textContent = source.join(' · ');
    const content = root.createElement('p');
    content.className = 'result-content';
    content.textContent = hit.content || '';
    card.append(header, metadata, content);
    container.append(card);
  });
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  return `${bytes} B`;
}

function setStatus(element, text, state = 'pending') {
  element.textContent = text;
  element.dataset.state = state;
}
