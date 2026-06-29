// ==UserScript==
// @name         DXM Tampermonkey Execution Diagnostic
// @namespace    https://codex.local/dianxiaomi-automation-v1
// @version      0.0.1
// @description  Minimal visual execution check for Dianxiaomi pages. No business actions.
// @author       Codex
// @match        https://www.dianxiaomi.com/*
// @match        https://dianxiaomi.com/*
// @match        http://www.dianxiaomi.com/*
// @match        http://dianxiaomi.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ID = 'dxm-tm-execution-diagnostic-badge';
  const VERSION = '0.0.1';

  function mount() {
    const root = document.body || document.documentElement;
    if (!root || document.getElementById(ID)) return;

    document.documentElement.setAttribute('data-dxm-tm-execution-diagnostic', VERSION);

    const style = document.createElement('style');
    style.textContent = `
      #${ID}{
        position:fixed;
        right:18px;
        top:142px;
        z-index:2147483647;
        width:220px;
        padding:10px 12px;
        background:#065f46;
        color:#fff;
        border:2px solid #34d399;
        border-radius:8px;
        box-shadow:0 12px 30px rgba(6,95,70,.28);
        font:13px/1.45 Arial,"Microsoft YaHei",sans-serif;
      }
      #${ID} strong{display:block;color:#bbf7d0;margin-bottom:2px}
    `;
    (document.head || document.documentElement).appendChild(style);

    const badge = document.createElement('div');
    badge.id = ID;
    badge.innerHTML = `<strong>TM EXEC OK</strong>DXM diagnostic v${VERSION}<br>${location.hostname}`;
    root.appendChild(badge);

    console.log('[DXM Diagnostic] Tampermonkey execution confirmed', location.href);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
  setTimeout(mount, 1000);
})();
