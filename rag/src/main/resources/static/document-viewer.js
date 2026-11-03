/** 按文档 ID 读取完整提取文本；关闭时取消请求并恢复打开按钮焦点。 */
export function initializeDocumentViewer(root) {
  const dialog = root.getElementById('document-dialog');
  const title = root.getElementById('document-title');
  const status = root.getElementById('document-status');
  const content = root.getElementById('document-text');
  const retry = root.getElementById('retry-document');
  const closeButton = root.getElementById('close-document');
  let currentHit = null;
  let opener = null;
  let controller = null;
  let revision = 0;

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [closeButton, retry, content].filter(element => !element.hidden && !element.disabled);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && root.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && root.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  retry.addEventListener('click', loadOriginal);
  dialog.addEventListener('close', () => {
    revision += 1;
    controller?.abort();
    currentHit = null;
    content.textContent = '';
    content.hidden = true;
    dialog.setAttribute('aria-busy', 'false');
    root.body.classList.remove('has-document-dialog');
    if (opener?.isConnected) opener.focus();
    opener = null;
  });

  function open(hit, button) {
    currentHit = hit;
    opener = button;
    title.textContent = `完整原文 · ${hit.fileName || '来源未提供'}`;
    content.textContent = '';
    content.hidden = true;
    if (!dialog.open) dialog.showModal();
    root.body.classList.add('has-document-dialog');
    void loadOriginal();
  }

  async function loadOriginal() {
    if (!currentHit || !dialog.open) return;
    controller?.abort();
    controller = new globalThis.AbortController();
    const requestRevision = ++revision;
    const documentId = String(currentHit.documentId);
    content.textContent = '';
    content.hidden = true;
    retry.hidden = true;
    dialog.setAttribute('aria-busy', 'true');
    status.dataset.state = 'pending';
    status.textContent = '正在读取完整原文…';
    try {
      let response;
      try {
        response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/original`, { signal: controller.signal });
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new Error('网络连接失败，请确认 Java 服务仍在运行。');
      }
      let original;
      try {
        original = await response.json();
      } catch {
        throw new Error(`服务端未返回原文 JSON（HTTP ${response.status}），请检查服务。`);
      }
      if (requestRevision !== revision || !dialog.open) return;
      if (!response.ok) throw new Error(original?.message || `原文读取失败（HTTP ${response.status}）`);
      if (!original || original.documentId !== documentId || typeof original.fileName !== 'string'
          || typeof original.content !== 'string' || !original.content.trim()) {
        throw new Error('服务端原文响应格式不正确，请核对文档 ID 和服务版本。');
      }
      title.textContent = `完整原文 · ${original.fileName}`;
      content.textContent = original.content;
      content.hidden = false;
      content.scrollTop = 0;
      status.dataset.state = 'success';
      status.textContent = '已加载完整提取文本，包含未命中的部分；PDF/Word 的原始排版和图片不在这里显示。';
    } catch (error) {
      if (requestRevision !== revision || !dialog.open || error.name === 'AbortError') return;
      status.dataset.state = 'error';
      status.textContent = `原文读取失败：${error.message}`;
      retry.hidden = false;
    } finally {
      if (requestRevision === revision) dialog.setAttribute('aria-busy', 'false');
    }
  }

  return { open };
}
