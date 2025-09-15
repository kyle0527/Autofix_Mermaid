/**
 * Mermaid Renderer Module
 * @fileoverview Provides Mermaid initialization, rendering, and export functionality
 * Uses ESM import for Mermaid 11.11.0
 */

import mermaid from 'mermaid';

/**
 * Constants for configuration
 */
const MERMAID_CONFIG = {
  DEFAULT_THEME_LIGHT: 'default',
  DEFAULT_THEME_DARK: 'dark',
  SECURITY_LEVEL: 'strict',
  START_ON_LOAD: false,
};

/**
 * Get appropriate theme based on user's system preference
 * @returns {string} Theme name ('dark' or 'default')
 */
function getDefaultTheme() {
  try {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    return prefersDark ? MERMAID_CONFIG.DEFAULT_THEME_DARK : MERMAID_CONFIG.DEFAULT_THEME_LIGHT;
  } catch (error) {
    console.warn('Failed to detect color scheme preference:', error);
    return MERMAID_CONFIG.DEFAULT_THEME_LIGHT;
  }
}

/**
 * Initialize Mermaid with given options
 * @param {Object} options - Configuration options
 * @param {boolean} [options.startOnLoad=false] - Whether to start on DOM load
 * @param {string} [options.securityLevel='loose'] - Security level
 * @param {string} [options.theme] - Theme name
 * @returns {Object} Final configuration object
 * @throws {Error} If Mermaid library is not loaded
 */
export function initMermaid(options = {}) {
  const defaults = {
    startOnLoad: MERMAID_CONFIG.START_ON_LOAD,
    securityLevel: MERMAID_CONFIG.SECURITY_LEVEL,
    theme: getDefaultTheme(),
  };

  const config = { ...defaults, ...options };

  try {
    mermaid.initialize(config);
    console.debug('Mermaid initialized with config:', config);
    return config;
  } catch (error) {
    console.error('Failed to initialize Mermaid:', error);
    throw new Error(`Mermaid initialization failed: ${error.message}`);
  }
}

/**
 * Render Mermaid diagram
 * @param {string} code - Mermaid diagram code
 * @param {string|Object} target - Target selector or options object
 * @param {string} [target.target] - CSS selector for container
 * @param {Element} [target.container] - DOM element container
 * @param {number} [target.width] - SVG width
 * @param {number} [target.height] - SVG height
 * @returns {Promise<Object>} Render result with svg and element
 */
export async function renderMermaid(code, target = '#svg') {
  if (!code || typeof code !== 'string') {
    return { 
      error: 'Invalid diagram code provided. Expected non-empty string.' 
    };
  }

  // Parse target parameter - accept string selector or options object
  let container;
  let width = 0;
  let height = 0;

  if (typeof target === 'string') {
    container = document.querySelector(target);
  } else if (target && typeof target === 'object') {
    const { target: targetSel, container: containerEl, width: w = 0, height: h = 0 } = target;
    width = Number(w) || 0;
    height = Number(h) || 0;
    
    if (typeof targetSel === 'string') {
      container = document.querySelector(targetSel);
    } else if (containerEl?.querySelector) {
      container = containerEl;
    }
  }

  // Fallback to default containers
  if (!container) {
    container = document.querySelector('#svg') || 
               document.querySelector('#graphDiv') || 
               document.body;
  }

  // Clear container and generate unique ID
  container.innerHTML = '';
  const diagramId = `mmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const renderResult = await mermaid.render(diagramId, code);
    
    // Insert SVG into container
    container.innerHTML = renderResult.svg;

    // Bind interactive functions if available
    if (typeof renderResult.bindFunctions === 'function') {
      try {
        renderResult.bindFunctions(container);
      } catch (bindError) {
        console.warn('Failed to bind Mermaid interactive functions:', bindError);
      }
    }

    // Apply dimensions if specified
    const svgElement = container.querySelector('svg');
    if (svgElement) {
      if (width > 0) svgElement.setAttribute('width', String(width));
      if (height > 0) svgElement.setAttribute('height', String(height));
    }

    console.debug(`Mermaid diagram rendered successfully with ID: ${diagramId}`);
    
    return { 
      svg: renderResult.svg, 
      element: svgElement,
      id: diagramId
    };
  } catch (error) {
    console.error('Mermaid rendering failed:', error);
    return { 
      error: `Rendering failed: ${error.message || String(error)}` 
    };
  }
}

/**
 * Convert SVG string to PNG blob
 * @param {string} svgString - SVG content as string
 * @param {Object} options - Export options
 * @param {number} [options.width] - Output width in pixels
 * @param {number} [options.height] - Output height in pixels  
 * @param {string} [options.background='transparent'] - Background color
 * @returns {Promise<Blob>} PNG image blob
 * @throws {Error} If canvas context unavailable or conversion fails
 */
export async function svgToPNG(svgString, { width, height, background = 'transparent' } = {}) {
  if (!svgString || typeof svgString !== 'string') {
    throw new Error('Invalid SVG string provided');
  }

  // Create canvas with validated dimensions
  const canvas = document.createElement('canvas');
  const canvasWidth = Math.max(1, Math.ceil(width || 800));
  const canvasHeight = Math.max(1, Math.ceil(height || 600));
  
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context not available in this environment');
  }

  // Apply background if specified
  if (background && background !== 'transparent') {
    context.save();
    context.fillStyle = background;
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.restore();
  }

  try {
    // Try Canvg for better SVG support
    const canvgLib = detectCanvgLibrary();
    
    if (canvgLib) {
      console.debug('Using Canvg for SVG to PNG conversion');
      const canvgInstance = await canvgLib.fromString(context, svgString, {
        ignoreMouse: true,
        ignoreAnimation: true,
      });
      await canvgInstance.render();
    } else {
      // Fallback to native Image API
      console.debug('Using native Image API for SVG to PNG conversion');
      await renderSvgViaImage(context, svgString, canvasWidth, canvasHeight);
    }

    // Convert canvas to PNG blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.debug(`PNG conversion successful: ${blob.size} bytes`);
            resolve(blob);
          } else {
            reject(new Error('Failed to generate PNG blob from canvas'));
          }
        },
        'image/png',
        0.95 // Quality factor
      );
    });
  } catch (error) {
    console.error('SVG to PNG conversion failed:', error);
    throw new Error(`PNG conversion failed: ${error.message}`);
  }
}

/**
 * Detect available Canvg library
 * @returns {Object|null} Canvg library or null if not available
 */
function detectCanvgLibrary() {
  // Check for different Canvg library variations
  if (window.Canvg?.fromString) {
    return window.Canvg;
  }
  
  if (window.canvg?.Canvg?.fromString) {
    return window.canvg.Canvg;
  }
  
  return null;
}

/**
 * Render SVG using native Image API
 * @param {CanvasRenderingContext2D} context - Canvas context
 * @param {string} svgString - SVG content
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
async function renderSvgViaImage(context, svgString, width, height) {
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const imageUrl = URL.createObjectURL(svgBlob);

  try {
    await new Promise((resolve, reject) => {
      const image = new Image();
      
      image.onload = () => {
        try {
          context.drawImage(image, 0, 0, width, height);
          resolve();
        } catch (drawError) {
          reject(new Error(`Failed to draw image: ${drawError.message}`));
        }
      };

      image.onerror = () => {
        reject(new Error('Failed to load SVG as image'));
      };

      // Add timeout to prevent hanging
      setTimeout(() => {
        reject(new Error('SVG image loading timeout'));
      }, 10000);

      image.src = imageUrl;
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
