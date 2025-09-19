// Light-weight client-side complexity estimator for Mermaid flowcharts
// NOTE: Replace later with real IR-based metrics.
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS/Node
    module.exports = factory();
  } else {
    // Browser / Web Worker global
    const api = factory();
    root.estimateFlowchartComplexity = api.estimateFlowchartComplexity;
  }
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this), function () {
  function estimateFlowchartComplexity(code){
    try{
      const lines = String(code||'').split(/\n/);
      const edgePattern = /(-->|-\->|===|--\||==)/g; // simple heuristic
      const nodeIdPattern = /^[ \t]*([A-Za-z0-9_][A-Za-z0-9_-]*)\s*(?:\(|\[|\{|>|--|===|$)/;
      const nodes = new Set();
      let edges = 0;
      for(const line of lines){
        if(/^(flowchart|graph)\b/.test(line)) continue;
        const m = line.match(nodeIdPattern);
        if(m) nodes.add(m[1]);
        const matches = line.match(edgePattern);
        if(matches) edges += matches.length;
        // also parse patterns like A-->B to collect both sides
        const arrow = line.match(/([A-Za-z0-9_][A-Za-z0-9_-]*)\s*-->?\s*([A-Za-z0-9_][A-Za-z0-9_-]*)/);
        if(arrow){ nodes.add(arrow[1]); nodes.add(arrow[2]); }
      }
      // naive depth: count longest chain of arrows in a single line
      let depth = 1;
      for(const line of lines){
        const chain = line.split(/-->/).length; // rough
        if(chain > depth) depth = chain;
      }
      return { nodes: nodes.size, edges, depth, fanoutP95: 0, exceed:false, reasons:[] };
    }catch(e){
      return { nodes:0, edges:0, depth:0, fanoutP95:0, exceed:false, reasons:['est-failed']};
    }
  }

  return { estimateFlowchartComplexity };
});
