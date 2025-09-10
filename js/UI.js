/**
 * UI Controller Module
 * @fileoverview Handles user interface interactions and worker communication
 */

/**
 * DOM element selector utility
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} DOM element or null
 */
const $ = (id) => document.getElementById(id);

/**
 * Mermaid diagram detection patterns
 */
const MERMAID_PATTERNS = {
  INIT_DIRECTIVE: /^(%%\{.*\}%%)/m,
  DIAGRAM_TYPES: /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|journey|gitGraph|timeline|mindmap|sankey|xychart(?:-beta)?|block|packetDiagram)\b/,
  DIAGRAM_SYNTAX: /(-->|\-\->|==>|o\-\-|subgraph\s+|end\s*$|\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\})/m,
};

/**
 * Check if text appears to be Mermaid diagram code
 * @param {string} text - Text to analyze
 * @returns {boolean} True if likely Mermaid syntax
 */
function isLikelyMermaid(text) {
  const trimmedText = (text || '').trim();
  
  if (!trimmedText) {
    return false;
  }
  
  // Check for init directives
  if (MERMAID_PATTERNS.INIT_DIRECTIVE.test(trimmedText)) {
    return true;
  }
  
  // Check for diagram type headers
  if (MERMAID_PATTERNS.DIAGRAM_TYPES.test(trimmedText)) {
    return true;
  }
  
  // Check for common Mermaid syntax patterns
  if (MERMAID_PATTERNS.DIAGRAM_SYNTAX.test(trimmedText)) {
    return true;
  }
  
  return false;
}

/**
 * Normalize Mermaid header to ensure single, correct header format
 * @param {string} text - Input text
 * @returns {string} Normalized text with proper header
 */
function normalizeHeader(text) {
  let content = String(text || '').replace(/^\uFEFF/, '');
  
  // Fix glued headers like: "flowchart TDflowchart TB ..."
  content = content.replace(/\b(TD|TB|LR|RL)\s*(?=(?:flowchart|graph)\b)/ig, '$1\n');
  
  const lines = content.split(/\r?\n/);
  const initLines = [];
  let currentIndex = 0;
  
  // Collect leading init/comment/blank lines (keep them)
  while (currentIndex < lines.length) {
    const line = lines[currentIndex].trim();
    if (line === '' || /^%%\{.*\}%%$/.test(line)) {
      initLines.push(lines[currentIndex]);
      currentIndex += 1;
      continue;
    }
    break;
  }
  
  const headerRegex = /^(?:flowchart|graph)\s+[A-Za-z]{2}\b/i;
  const classSeqRegex = /^(classDiagram|sequenceDiagram)\b/i;
  let detectedType = '';
  let restIndex = currentIndex;
  
  // Remove all consecutive headers (and blanks) after init section
  while (restIndex < lines.length) {
    const line = lines[restIndex].trim();
    if (line === '') {
      restIndex += 1;
      continue;
    }
    
    if (headerRegex.test(line)) {
      if (!detectedType) detectedType = 'flowchart';
      restIndex += 1;
      continue;
    }
    
    const classSeqMatch = line.match(classSeqRegex);
    if (classSeqMatch) {
      if (!detectedType) detectedType = classSeqMatch[1];
      restIndex += 1;
      continue;
    }
    
    break;
  }
  
  let remainingLines = lines.slice(restIndex);
  
  // If the first few lines in rest still start with a header, strip only the header prefix
  const stripHeaderPrefix = (line) => 
    line.replace(/^\s*(?:flowchart|graph)\s+[A-Za-z]{2}\b\s*/i, '')
        .replace(/^\s*(?:classDiagram|sequenceDiagram)\b\s*/i, '');
  
  for (let index = 0; index < Math.min(remainingLines.length, 5); index += 1) {
    const line = remainingLines[index].trim();
    if (/^(?:flowchart|graph)\s+[A-Za-z]{2}\b/i.test(line) || 
        /^(?:classDiagram|sequenceDiagram)\b/i.test(line)) {
      remainingLines[index] = stripHeaderPrefix(remainingLines[index]);
    } else {
      // Stop early once we hit a normal content line
      break;
    }
  }

  // Build normalized output
  const output = [];
  if (initLines.length) output.push(...initLines);
  
  if (detectedType === 'classDiagram' || detectedType === 'sequenceDiagram') {
    output.push(detectedType);
  } else {
    output.push('flowchart TD');
  }
  
  return output.join('\n') + '\n' + remainingLines.join('\n');
}

/**
 * Initialize UI components and event handlers
 * @param {Function} renderMermaid - Mermaid rendering function
 * @param {Function} svgToPNG - SVG to PNG conversion function  
 * @param {Function} initMermaid - Mermaid initialization function
 */
function initializeUI(renderMermaid, svgToPNG, initMermaid) {
  let lastResult = { code: '', svg: '', errors: [], log: [], dtype: '' };

  /**
   * Set application status
   * @param {boolean} isOk - Whether operation was successful
   * @param {string} message - Status message
   */
  function setStatus(isOk, message) {
    const statusElement = $('status');
    const messageElement = $('statusMsg');
    
    if (statusElement) {
      statusElement.textContent = isOk ? 'OK' : 'WORKING';
    }
    
    if (messageElement) {
      messageElement.textContent = message || '';
    }
  }

  /**
   * Show user notification
   * @param {string} message - Notification message
   */
  function showNotice(message) {
    const noticeElement = $('notice');
    if (!noticeElement) return;
    
    noticeElement.textContent = message || '';
    noticeElement.style.display = message ? 'block' : 'none';
  }

  /**
   * Download file to user's computer
   * @param {string} fileName - Name for downloaded file
   * @param {string|Blob} data - File data
   * @param {string} mimeType - MIME type
   */
  function downloadFile(fileName, data, mimeType = 'text/plain') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    
    setTimeout(() => URL.revokeObjectURL(url), 300);
  }

  /**
   * Ensure Mermaid is initialized with current settings
   */
  function ensureMermaidInit() {
    const securityLevel = $('secLevel')?.value || 'strict';
    
    try {
      initMermaid?.({ 
        securityLevel, 
        logLevel: 'fatal' 
      });
    } catch (error) {
      console.warn('Mermaid initialization skipped/failed:', error);
    }
  }

  /**
   * Main processing function
   * @param {boolean} autoMode - Whether in auto mode
   * @returns {Promise<Object|null>} Processing result
   */
  async function processInput(autoMode) {
    try {
      const svgContainer = $('svg');
      const logElement = $('log');
      
      // Clear previous results
      if (svgContainer) svgContainer.innerHTML = '';
      if (logElement) logElement.textContent = '';
      
      setStatus(false, '分析中…');

      const diagramType = $('diagramType')?.value || 'flowchart';
      const width = parseInt($('svgW')?.value || '0', 10) || 0;
      const height = parseInt($('svgH')?.value || '0', 10) || 0;

      const sourceMode = (document.querySelector('input[name="sourceMode"]:checked') || { value: 'auto' }).value;
      const inputText = $('src')?.value || '';

      // Direct Mermaid rendering path
      if (sourceMode === 'mermaid' || (sourceMode === 'auto' && isLikelyMermaid(inputText))) {
        const normalizedCode = normalizeHeader(inputText);
        const renderResult = await renderMermaid(normalizedCode, { width, height });
        
        if (renderResult.error) {
          throw new Error(renderResult.error);
        }
        
        if (svgContainer) svgContainer.innerHTML = renderResult.svg;
        if (logElement) logElement.textContent = normalizedCode;
        
        setStatus(true, 'OK 直接渲染 Mermaid');
        return { code: normalizedCode, errors: [], log: [], dtype: 'mermaid' };
      }

      // Python analysis via Worker
      const files = await collectFiles(inputText);
      const worker = new Worker(`js/worker.js?v=${Date.now()}`, { type: 'classic' });
      const options = { 
        lang: 'python', 
        diagram: diagramType, 
        mode: 'python', 
        useWTS: true, 
        wasmBase: 'js/wasm' 
      };

      const result = await new Promise((resolve, reject) => {
        let isSettled = false;
        const timeout = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            try { 
              worker.terminate(); 
            } catch (error) {
              console.warn('Worker termination failed:', error);
            }
            reject(new Error('Worker timeout after 90 seconds'));
          }
        }, 90000);

        worker.onmessage = async (event) => {
          if (isSettled) return;
          
          isSettled = true;
          clearTimeout(timeout);
          
          try { 
            worker.terminate(); 
          } catch (error) {
            console.warn('Worker termination failed:', error);
          }

          const { code, errors = [], log = [], dtype = '' } = event.data || {};
          
          // Safety: normalize worker output header
          const safeCode = normalizeHeader(code);
          const renderResult = await renderMermaid(safeCode, { width, height });
          
          if (renderResult.error) {
            throw new Error(String(renderResult.error));
          }
          
          if (svgContainer) svgContainer.innerHTML = renderResult.svg;
          if (logElement) {
            const logText = Array.isArray(log) 
              ? log.map(item => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n')
              : '';
            logElement.textContent = logText + '\n\n' + safeCode;
          }
          
          setStatus(true, dtype ? `OK 偵測到圖表：${dtype}` : 'OK');
          resolve({ code: safeCode, errors, log, dtype });
        };

        worker.onerror = (error) => {
          if (isSettled) return;
          
          isSettled = true;
          clearTimeout(timeout);
          
          try { 
            worker.terminate(); 
          } catch (termError) {
            console.warn('Worker termination failed:', termError);
          }
          
          const errorMessage = error instanceof Error ? error : new Error(String(error?.message || error));
          reject(errorMessage);
        };

        worker.postMessage({ files, options });
      });

      lastResult = result;
      return result;

    } catch (error) {
      console.error('Processing failed:', error);
      showNotice(`發生錯誤：${error?.message || error}`);
      setStatus(false, error?.message || String(error));
      return null;
    }
  }

  /**
   * Collect files from input or file selection
   * @param {string} textInput - Text input content
   * @returns {Promise<Object>} Files object
   */
  async function collectFiles(textInput) {
    const fileInput = $('fileInput');
    const filesMap = {};
    
    if (fileInput?.files && fileInput.files.length > 0) {
      const readFileAsText = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsText(file);
      });

      for (const file of fileInput.files) {
        const key = file.webkitRelativePath || file.name;
        try {
          filesMap[key] = await readFileAsText(file);
        } catch (error) {
          console.warn(`讀取檔案失敗：${file.name}`, error);
        }
      }
      
      return filesMap;
    }

    return { "main.py": textInput };
  }

  /**
   * Self-test function for development
   */
  async function runSelfTest() {
    const svgContainer = $('svg');
    const logElement = $('log');
    
    if (svgContainer) svgContainer.innerHTML = '';
    if (logElement) logElement.textContent = '';
    
    setStatus(false, '自我檢測中…');

    const worker = new Worker(`js/worker.js?v=${Date.now()}`, { type: 'classic' });
    const testFiles = { 
      'main.py': 'def a(x):\n  return x\n\ndef b(y):\n  return a(y)\n' 
    };
    const options = { 
      lang: 'python', 
      diagram: 'sequenceDiagram', 
      mode: 'python', 
      useWTS: true, 
      wasmBase: 'js/wasm' 
    };

    const result = await new Promise((resolve, reject) => {
      let isSettled = false;
      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try { 
            worker.terminate(); 
          } catch (error) {
            console.warn('Worker termination failed:', error);
          }
          reject(new Error('Self-test timeout'));
        }
      }, 30000);

      worker.onmessage = async (event) => {
        if (isSettled) return;
        
        isSettled = true;
        clearTimeout(timeout);
        
        try { 
          worker.terminate(); 
        } catch (error) {
          console.warn('Worker termination failed:', error);
        }
        
        resolve(event.data || {});
      };

      worker.onerror = (error) => {
        if (isSettled) return;
        
        isSettled = true;
        clearTimeout(timeout);
        
        try { 
          worker.terminate(); 
        } catch (termError) {
          console.warn('Worker termination failed:', termError);
        }
        
        const errorMessage = error instanceof Error ? error : new Error(String(error?.message || error));
        reject(errorMessage);
      };

      worker.postMessage({ files: testFiles, options });
    });

    try {
      const { code, log = [] } = result;
      const renderResult = await renderMermaid(code, {});
      
      if (renderResult.error) {
        throw new Error(renderResult.error);
      }
      
      if (svgContainer) svgContainer.innerHTML = renderResult.svg;
      
      const diagnostics = log.find(item => item && item.rule === 'worker.diag');
      const webTreeSitter = log.find(item => item && item.rule === 'worker.wts');
      
      if (logElement) {
        logElement.textContent = 
          `diag: ${diagnostics ? diagnostics.msg : 'n/a'}\n` +
          `${webTreeSitter ? 'web-tree-sitter used' : 'fallback parser'}`;
      }
      
      setStatus(true, webTreeSitter ? 'OK（使用 web-tree-sitter）' : 'OK（使用 fallback 解析）');
    } catch (error) {
      showNotice(`自我檢測失敗：${error?.message || error}`);
      setStatus(false, error?.message || String(error));
    }
  }

  /**
   * Bind event handlers to UI elements
   */
  function bindEventHandlers() {
    // Auto-render functionality
    const autoRenderCheckbox = $('autoRender');
    const triggerRender = () => processInput(false);
    
    if (autoRenderCheckbox) {
      autoRenderCheckbox.addEventListener('change', () => {
        if (autoRenderCheckbox.checked) {
          triggerRender();
        }
      });
    }

    // Input change handlers for auto-render
    const inputElements = ['src', 'svgW', 'svgH', 'pngWidth', 'pngHeight', 'pngBG', 'diagramType', 'secLevel'];
    
    for (const elementId of inputElements) {
      const element = $(elementId);
      if (element) {
        const autoRenderHandler = () => {
          const autoCheckbox = $('autoRender');
          if (autoCheckbox?.checked) {
            triggerRender();
          }
        };
        
        element.addEventListener('input', autoRenderHandler);
        element.addEventListener('change', autoRenderHandler);
      }
    }

    // File input handler
    const fileInput = $('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const autoCheckbox = $('autoRender');
        if (autoCheckbox?.checked) {
          triggerRender();
        }
      });
    }

    // Main action buttons
    $('btnRender')?.addEventListener('click', () => processInput(false));
    $('btnFixRender')?.addEventListener('click', () => processInput(true));
    $('btnSelfTest')?.addEventListener('click', runSelfTest);

    // Export buttons
    $('btnExportMMD')?.addEventListener('click', () => {
      downloadFile('diagram.mmd', lastResult?.code || '');
    });

    $('btnExportSVG')?.addEventListener('click', () => {
      const svgElement = document.querySelector('#graphDiv svg') || document.querySelector('#svg svg');
      if (!svgElement) {
        alert('沒有可匯出的 SVG');
        return;
      }
      
      const svgString = new XMLSerializer().serializeToString(svgElement);
      downloadFile('diagram.svg', svgString, 'image/svg+xml');
    });

    $('btnExportErrors')?.addEventListener('click', () => {
      const errorData = JSON.stringify(lastResult?.errors || [], null, 2);
      downloadFile('errors.json', errorData, 'application/json');
    });

    $('btnExportFixlog')?.addEventListener('click', () => {
      const logData = JSON.stringify(lastResult?.log || [], null, 2);
      downloadFile('fixlog.json', logData, 'application/json');
    });

    $('btnExportPNG')?.addEventListener('click', async () => {
      const svgElement = document.querySelector('#graphDiv svg') || document.querySelector('#svg svg');
      if (!svgElement) {
        alert('沒有可匯出的 SVG');
        return;
      }

      const pngBackground = $('pngBG')?.value || 'transparent';
      let pngWidth = parseInt($('pngWidth')?.value || '0', 10) || 0;
      let pngHeight = parseInt($('pngHeight')?.value || '0', 10) || 0;

      if (pngWidth === 0 || pngHeight === 0) {
        const boundingRect = svgElement.getBoundingClientRect();
        pngWidth = pngWidth || Math.ceil(boundingRect.width) || 1024;
        pngHeight = pngHeight || Math.ceil(boundingRect.height) || 768;
      }

      const svgString = new XMLSerializer().serializeToString(svgElement);
      
      try {
        const pngBlob = await svgToPNG(svgString, { 
          width: pngWidth, 
          height: pngHeight, 
          background: pngBackground 
        });
        downloadFile('diagram.png', pngBlob, 'image/png');
      } catch (error) {
        console.error('PNG 轉出失敗：', error);
        alert(`PNG 轉出失敗：${error?.message || error}`);
      }
    });
  }

  // Initialize the UI
  bindEventHandlers();
}

export { initializeUI };
