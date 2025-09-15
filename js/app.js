
import mermaid from 'mermaid';
import { sanitize } from './sanitize.js';
import { loadDocList, loadDocInto } from './docs.js';
import { bindConfigPanel } from './configPanel.js';

// P1 Docs and Config integration for Autofix_Mermaid
export function initP1Features() {
  // Bind config panel if exists
  const configForm = document.getElementById('config-form');
  if (configForm && typeof bindConfigPanel === 'function') {
    bindConfigPanel(mermaid);
  }

  // Bind docs functionality if exists
  const docSelect = document.getElementById('doc-select');
  const docView = document.getElementById('doc-view');
  if (docSelect && docView && typeof loadDocList === 'function') {
    loadDocList().then(list => {
      if (list && list.length > 0) {
        // Clear existing options
        docSelect.innerHTML = '';
        // Add new options
        for(const f of list){
          const opt = document.createElement('option');
          opt.value = f;
          opt.textContent = f;
          docSelect.appendChild(opt);
        }
        // Set default and load first doc
        docSelect.value = list[0];
        loadDocInto(docView, list[0]);
        // Bind change event
        docSelect.onchange = () => loadDocInto(docView, docSelect.value);
      }
    }).catch(err => {
      console.warn('Failed to load docs:', err);
    });
  }
}

// Toggle panels functionality
export function toggleDocsPanel() {
  const panel = document.getElementById('docsPanel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}

export function toggleConfigPanel() {
  const panel = document.getElementById('configPanel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
}
