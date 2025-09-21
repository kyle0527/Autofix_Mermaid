import { AIRegistry } from './providerRegistry.mjs';

export async function aiAnalyze(files, options = {}) {
  const reg = AIRegistry;
  const providerName = (options.provider || 'none');
  const provider = reg.get(providerName) || reg.get('none');
  if (!provider) throw new Error('No AI provider available');
  try {
    const res = await provider.analyze(files || {}, options || {});
    return res;
  } catch (e) {
    return { code: '', errors: [String(e)], log: [{ rule: 'ai.error', msg: String(e) }], dtype: options.diagram || 'flowchart' };
  }
}

export function listProviders() { return AIRegistry.list(); }
