// ==UserScript==
// @name         店小秘自动化系统 V1 - 自动执行器
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      0.2.0
// @description  从接口探测记录升级为接口调用：自动保存模板、返回/刷新采集箱、启动助手、读取状态、结束/暂停任务。
// @author       Codex
// @match        https://*.dianxiaomi.com/*
// @match        http://*.dianxiaomi.com/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  const APP_NAME = '店小秘自动化系统 V1 - 自动执行器';
  const VERSION = '0.2.0';
  const PANEL_ID = 'dxm-auto-executor-panel';
  const LIBRARY_KEY = 'dxm_executor_interface_library_v1';
  const RUN_LOG_KEY = 'dxm_executor_run_log_v1';
  const PENDING_WORKFLOW_KEY = 'dxm_executor_pending_workflow_v1';
  const MAX_LOGS = 300;
  const WORKFLOW_STEPS = ['template_save', 'return_collection', 'collection_refresh', 'start', 'task_status', 'pause_or_finish'];

  const actionDefinitions = [
    {
      type: 'template_save',
      label: '自动保存模板',
      required: true,
      sourceTypes: ['template_save'],
      description: '调用已捕获的模板保存接口，复用原请求体。',
    },
    {
      type: 'return_collection',
      label: '自动返回采集箱',
      required: true,
      sourceTypes: ['collection_list'],
      description: '跳转到采集箱列表接口对应页面或捕获时的采集箱页面。',
    },
    {
      type: 'collection_refresh',
      label: '自动刷新采集箱',
      required: true,
      sourceTypes: ['collection_list'],
      description: '调用采集箱列表接口，验证列表可刷新。',
    },
    {
      type: 'start',
      label: '自动启动助手',
      required: true,
      sourceTypes: ['start'],
      description: '调用已捕获的开始/启动接口。',
    },
    {
      type: 'task_status',
      label: '自动读取任务状态',
      required: true,
      sourceTypes: ['task_status'],
      description: '调用任务状态接口，读取进度或结果。',
    },
    {
      type: 'pause_or_finish',
      label: '自动结束/暂停任务',
      required: true,
      sourceTypes: ['pause_or_finish'],
      description: '调用暂停、停止、结束或完成接口。',
    },
  ];

  const state = {
    library: loadLibrary(),
    logs: loadLogs(),
    pendingWorkflow: loadPendingWorkflow(),
    running: false,
    panelReady: false,
    confirmRealCalls: GM_getValue('dxm_executor_confirm_real_calls', false),
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function safeJsonParse(text, fallback = null) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return fallback;
    }
  }

  function shortText(value, max = 3000) {
    if (value == null) return '';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function loadLibrary() {
    const value = GM_getValue(LIBRARY_KEY, null);
    return value && typeof value === 'object' ? value : { records: [], verified: {}, updatedAt: null };
  }

  function saveLibrary() {
    state.library.updatedAt = nowIso();
    GM_setValue(LIBRARY_KEY, state.library);
  }

  function loadLogs() {
    const value = GM_getValue(RUN_LOG_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function loadPendingWorkflow() {
    const value = GM_getValue(PENDING_WORKFLOW_KEY, null);
    return value && typeof value === 'object' ? value : null;
  }

  function saveLogs() {
    GM_setValue(RUN_LOG_KEY, state.logs.slice(-MAX_LOGS));
  }

  function savePendingWorkflow(nextIndex, reason) {
    state.pendingWorkflow = {
      active: true,
      nextIndex,
      reason,
      savedAt: nowIso(),
    };
    GM_setValue(PENDING_WORKFLOW_KEY, state.pendingWorkflow);
  }

  function clearPendingWorkflow() {
    state.pendingWorkflow = null;
    GM_setValue(PENDING_WORKFLOW_KEY, null);
  }

  function addLog(level, message, detail = {}) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: nowIso(),
      level,
      message,
      detail,
    };
    state.logs.push(entry);
    saveLogs();
    updatePanel();
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
    console[consoleMethod](`[${APP_NAME}] ${message}`, detail);
    return entry;
  }

  function normalizeUrl(url) {
    if (!url) return '';
    try {
      return new URL(url, location.origin).toString();
    } catch (_) {
      return String(url);
    }
  }

  function getTopMatchType(record) {
    const match = record && record.matches && record.matches[0];
    return match && match.type ? match.type : '';
  }

  function sanitizeHeaders(headers) {
    const result = {};
    const forbidden = new Set([
      'accept-encoding',
      'connection',
      'content-length',
      'cookie',
      'host',
      'origin',
      'referer',
      'sec-fetch-dest',
      'sec-fetch-mode',
      'sec-fetch-site',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'user-agent',
    ]);
    Object.entries(headers || {}).forEach(([key, value]) => {
      const lower = String(key).toLowerCase();
      if (!forbidden.has(lower) && value != null) {
        result[key] = value;
      }
    });
    return result;
  }

  function inferContentType(headers, body) {
    const existingKey = Object.keys(headers).find((key) => key.toLowerCase() === 'content-type');
    if (existingKey) return headers;
    if (!body) return headers;
    const trimmed = String(body).trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return Object.assign({ 'content-type': 'application/json;charset=UTF-8' }, headers);
    }
    if (trimmed.includes('=') && trimmed.includes('&')) {
      return Object.assign({ 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' }, headers);
    }
    return headers;
  }

  function buildFetchOptions(record, overrides = {}) {
    const method = String(overrides.method || record.method || 'GET').toUpperCase();
    let body = overrides.body != null ? overrides.body : record.requestBody || '';
    if (method === 'GET' || method === 'HEAD') {
      body = undefined;
    }

    let headers = sanitizeHeaders(record.requestHeaders || {});
    headers = inferContentType(headers, body);

    return {
      method,
      headers,
      body,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'follow',
    };
  }

  async function callRecord(record, actionType, overrides = {}) {
    if (!record) {
      throw new Error(`缺少 ${actionType} 接口记录`);
    }
    if (!state.confirmRealCalls) {
      throw new Error('真实调用未开启。请先勾选“允许真实调用”。');
    }

    const url = normalizeUrl(overrides.url || record.url);
    const options = buildFetchOptions(record, overrides);
    const startedAt = performance.now();
    const response = await fetch(url, options);
    const responseText = await response.text();
    const durationMs = Math.round(performance.now() - startedAt);
    const parsed = safeJsonParse(responseText, null);
    const success = response.ok && !looksLikeLoginPage(responseText);

    const result = {
      actionType,
      actionLabel: getActionLabel(actionType),
      url,
      method: options.method,
      status: response.status,
      ok: response.ok,
      success,
      durationMs,
      responseText: shortText(responseText),
      responseJson: parsed,
      calledAt: nowIso(),
    };

    if (success) {
      markVerified(actionType, record, result);
      addLog('info', `${getActionLabel(actionType)} 调用成功`, result);
    } else {
      addLog('warn', `${getActionLabel(actionType)} 调用返回异常`, result);
    }
    return result;
  }

  function looksLikeLoginPage(text) {
    const lower = String(text || '').toLowerCase();
    return lower.includes('<html') && (lower.includes('login') || lower.includes('登录') || lower.includes('passport'));
  }

  function getActionLabel(type) {
    const action = actionDefinitions.find((item) => item.type === type);
    return action ? action.label : type;
  }

  function markVerified(actionType, record, result) {
    state.library.verified[actionType] = {
      type: actionType,
      label: getActionLabel(actionType),
      recordId: record.id || null,
      url: normalizeUrl(record.url),
      method: record.method || 'GET',
      verifiedAt: nowIso(),
      status: result.status,
      durationMs: result.durationMs,
      responseSample: shortText(result.responseText, 800),
    };
    saveLibrary();
  }

  function findCandidate(actionType) {
    const action = actionDefinitions.find((item) => item.type === actionType);
    const sourceTypes = action ? action.sourceTypes : [actionType];
    const candidates = state.library.records
      .filter((record) => sourceTypes.includes(getTopMatchType(record)))
      .sort((a, b) => {
        const aScore = a.matches && a.matches[0] ? a.matches[0].score || 0 : 0;
        const bScore = b.matches && b.matches[0] ? b.matches[0].score || 0 : 0;
        return bScore - aScore;
      });
    return candidates[0] || null;
  }

  function importRecordsFromDetector() {
    const detector =
      window.__DXM_INTERFACE_DETECTOR_V1__ ||
      (typeof unsafeWindow !== 'undefined' ? unsafeWindow.__DXM_INTERFACE_DETECTOR_V1__ : null);
    if (!detector || typeof detector.getRecords !== 'function') {
      addLog('warn', '未发现页面内探测器对象，请粘贴导出的 JSON 导入接口库');
      return 0;
    }
    const records = detector.getRecords();
    return mergeRecords(records, 'detector');
  }

  function importRecordsFromJsonText(text) {
    const parsed = safeJsonParse(text, null);
    if (!parsed) throw new Error('JSON 格式无效');
    const records = Array.isArray(parsed) ? parsed : parsed.records;
    if (!Array.isArray(records)) throw new Error('JSON 中未找到 records 数组');
    return mergeRecords(records, 'json');
  }

  function mergeRecords(records, source) {
    const existingKeys = new Set(
      state.library.records.map((record) => `${record.method || 'GET'} ${normalizeUrl(record.url)} ${record.requestBody || ''}`)
    );
    let added = 0;
    records.forEach((record) => {
      if (!record || !record.url) return;
      const key = `${record.method || 'GET'} ${normalizeUrl(record.url)} ${record.requestBody || ''}`;
      if (existingKeys.has(key)) return;
      state.library.records.push(Object.assign({}, record, { importedFrom: source, importedAt: nowIso() }));
      existingKeys.add(key);
      added += 1;
    });
    saveLibrary();
    addLog('info', `接口库导入完成，新增 ${added} 条`, { source, added, total: state.library.records.length });
    updatePanel();
    return added;
  }

  function clearLibrary() {
    state.library = { records: [], verified: {}, updatedAt: nowIso() };
    saveLibrary();
    addLog('info', '接口库已清空');
    updatePanel();
  }

  function clearLogs() {
    state.logs = [];
    saveLogs();
    updatePanel();
  }

  async function returnToCollection(options = {}) {
    const record = findCandidate('collection_refresh');
    if (!record) throw new Error('缺少采集箱列表接口记录，无法判断采集箱页面');

    const target = record.page && record.page.href ? record.page.href : '';
    if (!target) {
      addLog('warn', '采集箱记录缺少 page.href，改为调用列表接口刷新');
      return callRecord(record, 'collection_refresh');
    }

    markVerified('return_collection', record, {
      status: 0,
      durationMs: 0,
      responseText: `navigate:${target}`,
    });
    addLog('info', '准备返回采集箱页面', { target });
    if (typeof options.resumeIndex === 'number') {
      savePendingWorkflow(options.resumeIndex, 'return_collection_navigation');
    }
    location.href = target;
    return {
      actionType: 'return_collection',
      success: true,
      target,
      note: '已触发页面跳转，后续步骤需在采集箱页面继续执行。',
    };
  }

  async function runSingleAction(actionType) {
    if (state.running) throw new Error('已有执行任务运行中');
    state.running = true;
    updatePanel();
    try {
      if (actionType === 'return_collection') {
        return await returnToCollection();
      }
      const record = findCandidate(actionType);
      return await callRecord(record, actionType);
    } finally {
      state.running = false;
      updatePanel();
    }
  }

  async function runWorkflow(startIndex = 0) {
    if (state.running) throw new Error('已有执行任务运行中');
    state.running = true;
    updatePanel();
    const results = [];
    try {
      addLog('info', startIndex > 0 ? '自动执行流程恢复' : '自动执行流程开始', { startIndex });
      for (let index = startIndex; index < WORKFLOW_STEPS.length; index += 1) {
        const step = WORKFLOW_STEPS[index];
        if (step === 'return_collection') {
          results.push(await returnToCollection({ resumeIndex: index + 1 }));
          addLog('info', '已触发返回采集箱，页面重载后继续执行', { nextIndex: index + 1 });
          return results;
        }
        results.push(await callRecord(findCandidate(step), step));
        await sleep(step === 'start' ? 1500 : 800);
      }
      clearPendingWorkflow();
      addLog('info', '自动执行流程完成', { results });
      return results;
    } catch (error) {
      addLog('error', '自动执行流程失败', { error: error.message });
      throw error;
    } finally {
      state.running = false;
      updatePanel();
    }
  }

  function exportRunReport() {
    const report = {
      app: APP_NAME,
      version: VERSION,
      exportedAt: nowIso(),
      page: {
        href: location.href,
        title: document.title,
      },
      interfaceLibrary: state.library,
      verifiedCallableInterfaces: state.library.verified,
      logs: state.logs,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    GM_download({
      url,
      name: `dxm-executor-report-${Date.now()}.json`,
      saveAs: true,
      onload: () => URL.revokeObjectURL(url),
      onerror: () => URL.revokeObjectURL(url),
    });
  }

  function countCandidates() {
    const counts = {};
    actionDefinitions.forEach((action) => {
      counts[action.type] = findCandidate(action.type) ? 1 : 0;
    });
    return counts;
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="dxm-exec-header">
        <strong>店小秘自动执行 V1</strong>
        <span data-field="status"></span>
      </div>
      <div class="dxm-exec-body">
        <label class="dxm-exec-confirm">
          <input type="checkbox" data-action="toggle-real-calls">
          <span>允许真实调用</span>
        </label>
        <div class="dxm-exec-row">接口库：<strong data-field="library-count">0</strong> 条</div>
        <div class="dxm-exec-grid" data-field="candidates"></div>
        <div class="dxm-exec-actions">
          <button type="button" data-action="import-detector">导入探测器</button>
          <button type="button" data-action="paste-json">粘贴 JSON</button>
        </div>
        <div class="dxm-exec-actions">
          <button type="button" data-action="run-workflow">执行流程</button>
          <button type="button" data-action="export-report">导出报告</button>
        </div>
        <div class="dxm-exec-actions">
          <button type="button" data-action="clear-library">清空接口</button>
          <button type="button" data-action="clear-logs">清空日志</button>
        </div>
        <details>
          <summary>单步调用</summary>
          <div class="dxm-exec-single" data-field="single-actions"></div>
        </details>
        <div class="dxm-exec-log" data-field="latest-log"></div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 16px;
        bottom: 324px;
        z-index: 2147483646;
        width: 320px;
        color: #17202a;
        background: #ffffff;
        border: 1px solid #64748b;
        border-radius: 8px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.20);
        font: 12px/1.45 Arial, "Microsoft YaHei", sans-serif;
      }
      #${PANEL_ID} .dxm-exec-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border-bottom: 1px solid #e5e7eb;
      }
      #${PANEL_ID} .dxm-exec-body {
        padding: 8px 10px 10px;
      }
      #${PANEL_ID} .dxm-exec-confirm {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }
      #${PANEL_ID} .dxm-exec-row {
        margin-bottom: 6px;
      }
      #${PANEL_ID} .dxm-exec-grid {
        display: grid;
        gap: 4px;
        margin-bottom: 8px;
      }
      #${PANEL_ID} .dxm-exec-count {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      #${PANEL_ID} .dxm-exec-actions {
        display: flex;
        gap: 6px;
        margin-bottom: 6px;
      }
      #${PANEL_ID} button {
        min-height: 26px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #f8fafc;
        color: #111827;
        cursor: pointer;
        font: inherit;
      }
      #${PANEL_ID} button:hover {
        background: #dcfce7;
      }
      #${PANEL_ID} button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      #${PANEL_ID} .dxm-exec-actions button {
        flex: 1;
      }
      #${PANEL_ID} .dxm-exec-single {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin: 6px 0;
      }
      #${PANEL_ID} .dxm-exec-log {
        max-height: 72px;
        overflow: auto;
        padding: 6px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #f9fafb;
        color: #334155;
      }
    `;
    document.documentElement.appendChild(style);
    document.documentElement.appendChild(panel);

    panel.addEventListener('click', async (event) => {
      const action = event.target && event.target.getAttribute('data-action');
      if (!action || state.running) return;
      try {
        if (action === 'import-detector') importRecordsFromDetector();
        if (action === 'paste-json') {
          const text = window.prompt('粘贴第一阶段导出的 JSON：');
          if (text) importRecordsFromJsonText(text);
        }
        if (action === 'run-workflow') await runWorkflow();
        if (action === 'export-report') exportRunReport();
        if (action === 'clear-library') clearLibrary();
        if (action === 'clear-logs') clearLogs();
        if (action.startsWith('single:')) await runSingleAction(action.slice('single:'.length));
      } catch (error) {
        addLog('error', '操作失败', { action, error: error.message });
      }
    });

    panel.addEventListener('change', (event) => {
      const action = event.target && event.target.getAttribute('data-action');
      if (action === 'toggle-real-calls') {
        state.confirmRealCalls = Boolean(event.target.checked);
        GM_setValue('dxm_executor_confirm_real_calls', state.confirmRealCalls);
        addLog(state.confirmRealCalls ? 'warn' : 'info', state.confirmRealCalls ? '已开启真实调用' : '已关闭真实调用');
        updatePanel();
      }
    });

    state.panelReady = true;
    updatePanel();
  }

  function updatePanel() {
    if (!state.panelReady) return;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const status = panel.querySelector('[data-field="status"]');
    const libraryCount = panel.querySelector('[data-field="library-count"]');
    const candidates = panel.querySelector('[data-field="candidates"]');
    const singleActions = panel.querySelector('[data-field="single-actions"]');
    const latestLog = panel.querySelector('[data-field="latest-log"]');
    const realCalls = panel.querySelector('[data-action="toggle-real-calls"]');
    const buttons = panel.querySelectorAll('button');

    if (status) status.textContent = state.running ? '运行中' : '就绪';
    if (libraryCount) libraryCount.textContent = String(state.library.records.length);
    if (realCalls) realCalls.checked = state.confirmRealCalls;
    buttons.forEach((button) => {
      button.disabled = state.running;
    });

    const counts = countCandidates();
    if (candidates) {
      candidates.innerHTML = actionDefinitions
        .map((action) => {
          const verified = state.library.verified[action.type] ? '已验证' : '未验证';
          const hasCandidate = counts[action.type] ? '有候选' : '缺失';
          return `<div class="dxm-exec-count"><span>${action.label}</span><strong>${hasCandidate} / ${verified}</strong></div>`;
        })
        .join('');
    }

    if (singleActions) {
      singleActions.innerHTML = actionDefinitions
        .map((action) => `<button type="button" data-action="single:${action.type}">${action.label}</button>`)
        .join('');
    }

    if (latestLog) {
      const recent = state.logs.slice(-4).reverse();
      latestLog.innerHTML = recent.length
        ? recent.map((log) => `<div>[${log.level}] ${log.message}</div>`).join('')
        : '<div>暂无日志</div>';
    }
  }

  function boot() {
    createPanel();
    const publicApi = {
      importRecordsFromJsonText,
      importRecordsFromDetector,
      getLibrary: () => JSON.parse(JSON.stringify(state.library)),
      getLogs: () => state.logs.slice(),
      runSingleAction,
      runWorkflow,
      exportRunReport,
      clearLibrary,
      clearLogs,
      enableRealCalls: () => {
        state.confirmRealCalls = true;
        GM_setValue('dxm_executor_confirm_real_calls', true);
        updatePanel();
      },
      disableRealCalls: () => {
        state.confirmRealCalls = false;
        GM_setValue('dxm_executor_confirm_real_calls', false);
        updatePanel();
      },
    };
    window.__DXM_AUTO_EXECUTOR_V1__ = publicApi;
    if (typeof unsafeWindow !== 'undefined') {
      unsafeWindow.__DXM_AUTO_EXECUTOR_V1__ = publicApi;
    }
    addLog('info', '自动执行器已加载', { version: VERSION, href: location.href });
    if (state.pendingWorkflow && state.pendingWorkflow.active) {
      if (state.confirmRealCalls) {
        const nextIndex = Number(state.pendingWorkflow.nextIndex || 0);
        addLog('info', '检测到未完成流程，准备续跑', { nextIndex, pending: state.pendingWorkflow });
        window.setTimeout(() => {
          runWorkflow(nextIndex).catch((error) => {
            addLog('error', '续跑失败', { error: error.message });
          });
        }, 1500);
      } else {
        addLog('warn', '检测到未完成流程，但真实调用未开启，已暂停续跑', { pending: state.pendingWorkflow });
      }
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
