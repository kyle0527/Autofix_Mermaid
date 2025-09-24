// Layout selector: default / elk / tidytree (hint config; real effect requires plugin in engine build)
const DEFAULT_CONFIG = { startOnLoad: false, securityLevel: 'strict' };
let lastKnownConfig = null;

export function applyLayoutSelection(mermaid, layout) {
  if (!mermaid?.initialize) return;

  const existingConfig = typeof mermaid?.mermaidAPI?.getConfig === 'function'
    ? mermaid.mermaidAPI.getConfig()
    : null;

  const baseConfig = cloneConfig(existingConfig || lastKnownConfig || DEFAULT_CONFIG);

  if (typeof baseConfig.startOnLoad !== 'boolean') {
    baseConfig.startOnLoad = DEFAULT_CONFIG.startOnLoad;
  }
  if (!baseConfig.securityLevel) {
    baseConfig.securityLevel = DEFAULT_CONFIG.securityLevel;
  }

  const flowchartConfig = {
    ...(baseConfig.flowchart || {})
  };

  if (layout === 'elk') {
    flowchartConfig.layout = 'elk';
  } else if (layout === 'tidytree') {
    flowchartConfig.layout = 'tidy';
  } else {
    delete flowchartConfig.layout;
  }

  if (Object.keys(flowchartConfig).length > 0) {
    baseConfig.flowchart = flowchartConfig;
  } else {
    delete baseConfig.flowchart;
  }

  mermaid.initialize(baseConfig);
  lastKnownConfig = cloneConfig(baseConfig);
}

function cloneConfig(config) {
  if (!config || typeof config !== 'object') {
    return {};
  }

  const cloned = { ...config };

  for (const [key, value] of Object.entries(cloned)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      cloned[key] = { ...value };
    }
  }

  return cloned;
}
