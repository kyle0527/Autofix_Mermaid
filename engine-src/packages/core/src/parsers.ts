import path from 'node:path';
import {
  ParserPlugin,
  ParserDetectionResult,
  ParserDetectConfidence,
} from '@diagrammender/types';

const registry = new Map<string, ParserPlugin>();

function normalizeLang(lang: string): string {
  return lang.trim().toLowerCase();
}

const CONFIDENCE_ORDER: Record<ParserDetectConfidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function maxConfidence(a: ParserDetectConfidence, b: ParserDetectConfidence): ParserDetectConfidence {
  return CONFIDENCE_ORDER[a] >= CONFIDENCE_ORDER[b] ? a : b;
}

function scoreConfidence(conf?: ParserDetectConfidence): number {
  if (!conf) return 0;
  return CONFIDENCE_ORDER[conf];
}

const EXTENSION_HINTS: Record<string, { lang: string; confidence: ParserDetectConfidence }> = {
  '.py':   { lang: 'python', confidence: 'high' },
  '.pyi':  { lang: 'python', confidence: 'medium' },
  '.js':   { lang: 'javascript', confidence: 'medium' },
  '.jsx':  { lang: 'javascript', confidence: 'medium' },
  '.ts':   { lang: 'typescript', confidence: 'high' },
  '.tsx':  { lang: 'typescript', confidence: 'medium' },
  '.mjs':  { lang: 'javascript', confidence: 'medium' },
  '.cjs':  { lang: 'javascript', confidence: 'medium' },
  '.java': { lang: 'java', confidence: 'medium' },
  '.go':   { lang: 'go', confidence: 'medium' },
  '.cs':   { lang: 'csharp', confidence: 'medium' },
  '.rs':   { lang: 'rust', confidence: 'medium' },
  '.rb':   { lang: 'ruby', confidence: 'medium' },
  '.php':  { lang: 'php', confidence: 'medium' },
  '.c':    { lang: 'c', confidence: 'medium' },
  '.h':    { lang: 'c', confidence: 'low' },
  '.cc':   { lang: 'cpp', confidence: 'medium' },
  '.cpp':  { lang: 'cpp', confidence: 'medium' },
  '.cxx':  { lang: 'cpp', confidence: 'medium' },
  '.hh':   { lang: 'cpp', confidence: 'low' },
  '.hpp':  { lang: 'cpp', confidence: 'low' },
  '.m':    { lang: 'objective-c', confidence: 'medium' },
  '.swift': { lang: 'swift', confidence: 'medium' },
};

interface HeuristicCandidate {
  detection: ParserDetectionResult;
  count: number;
}

function collectHeuristicCandidates(files: Record<string, string>): Map<string, HeuristicCandidate> {
  const byLang = new Map<string, {
    count: number;
    files: string[];
    exts: Set<string>;
    confidence: ParserDetectConfidence;
  }>();

  for (const filePath of Object.keys(files)) {
    const ext = path.extname(filePath).toLowerCase();
    if (!ext) continue;
    const hint = EXTENSION_HINTS[ext];
    if (!hint) continue;
    const lang = normalizeLang(hint.lang);
    let entry = byLang.get(lang);
    if (!entry) {
      entry = {
        count: 0,
        files: [],
        exts: new Set<string>(),
        confidence: hint.confidence,
      };
      byLang.set(lang, entry);
    } else {
      entry.confidence = maxConfidence(entry.confidence, hint.confidence);
    }
    entry.count += 1;
    entry.exts.add(ext);
    if (entry.files.length < 5) {
      entry.files.push(filePath);
    }
  }

  const heuristics = new Map<string, HeuristicCandidate>();
  for (const [lang, meta] of byLang) {
    if (meta.count === 0) continue;
    const exts = Array.from(meta.exts.values());
    const reason = meta.count === 1
      ? `Found ${exts[0] ?? ''} file ${meta.files[0]}`
      : `Found ${meta.count} files (${exts.join(', ')})`;
    heuristics.set(lang, {
      count: meta.count,
      detection: {
        lang,
        confidence: meta.confidence,
        reason,
        matchedFiles: meta.files,
      },
    });
  }
  return heuristics;
}

function isParserPlugin(candidate: any): candidate is ParserPlugin {
  return (
    candidate &&
    typeof candidate === 'object' &&
    typeof candidate.lang === 'string' &&
    typeof candidate.parseProject === 'function'
  );
}

function extractPlugin(mod: any): ParserPlugin | null {
  if (!mod) return null;
  const candidate = mod.parserPlugin ?? mod.default ?? mod;
  return isParserPlugin(candidate) ? candidate : null;
}

function candidateModuleIds(lang: string): string[] {
  const normalized = normalizeLang(lang).replace(/[^a-z0-9]+/g, '-');
  const ids = new Set<string>();
  ids.add(`@diagrammender/parsers-${normalized}`);
  ids.add(`@diagrammender/parser-${normalized}`);
  ids.add(`@diagrammender/parsers/${normalized}`);
  ids.add(`diagrammender-parser-${normalized}`);
  const localRoot = path.join(__dirname, '..', 'parsers', normalized);
  ids.add(localRoot);
  ids.add(path.join(localRoot, 'dist'));
  ids.add(path.join(localRoot, 'dist', 'src'));
  return Array.from(ids);
}

function tryRequire(moduleId: string): ParserPlugin | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(moduleId);
    return extractPlugin(mod);
  } catch (err: any) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      const msg = typeof err.message === 'string' ? err.message : '';
      if (msg.includes(moduleId)) {
        return null;
      }
    }
    throw err;
  }
}

export function registerParserPlugin(plugin: ParserPlugin): ParserPlugin {
  const primary = normalizeLang(plugin.lang);
  registry.set(primary, plugin);
  if (plugin.aliases) {
    for (const alias of plugin.aliases) {
      registry.set(normalizeLang(alias), plugin);
    }
  }
  return plugin;
}

export function clearParserPlugins(): void {
  registry.clear();
}

export function listParserPlugins(): ParserPlugin[] {
  return Array.from(new Set(registry.values()));
}

export function getRegisteredParserPlugin(lang: string): ParserPlugin | undefined {
  return registry.get(normalizeLang(lang));
}

export async function loadParserPlugin(lang: string): Promise<ParserPlugin> {
  const normalized = normalizeLang(lang);
  const existing = registry.get(normalized);
  if (existing) return existing;

  for (const moduleId of candidateModuleIds(normalized)) {
    const plugin = tryRequire(moduleId);
    if (plugin) {
      registerParserPlugin(plugin);
      registry.set(normalized, plugin);
      return plugin;
    }
  }

  throw new Error(`Parser plugin not found for language: ${lang}`);
}

export interface ResolveParserOptions {
  /** Explicit language identifier. Use 'auto' to trigger detection. */
  lang?: string;
  /** Files to inspect for detection / heuristics. Required when lang is omitted or 'auto'. */
  files?: Record<string, string>;
  /** Additional candidate languages to consider. */
  candidates?: string[];
  /** Whether to execute plugin detection hooks. Defaults to true. */
  detect?: boolean;
  /** Whether to use filename heuristics. Defaults to true. */
  allowHeuristics?: boolean;
}

export interface ParserResolution {
  plugin: ParserPlugin;
  detection?: ParserDetectionResult;
}

export async function resolveParserPlugin(options: ResolveParserOptions): Promise<ParserResolution> {
  const {
    lang,
    files,
    candidates = [],
    detect = true,
    allowHeuristics = true,
  } = options;

  if (lang && lang !== 'auto') {
    const plugin = await loadParserPlugin(lang);
    let detection: ParserDetectionResult | undefined;
    if (detect && files && typeof plugin.detect === 'function') {
      detection = plugin.detect(files) ?? undefined;
    }
    if (!detection && files && allowHeuristics) {
      detection = collectHeuristicCandidates(files).get(normalizeLang(plugin.lang))?.detection;
    }
    return { plugin, detection };
  }

  if (!files) {
    throw new Error('resolveParserPlugin requires files when language is not specified.');
  }

  const heuristics = allowHeuristics ? collectHeuristicCandidates(files) : new Map<string, HeuristicCandidate>();
  const candidatesByLang = new Map<string, { heuristic?: HeuristicCandidate }>();

  for (const cand of candidates) {
    candidatesByLang.set(normalizeLang(cand), {});
  }
  for (const [langId, heuristic] of heuristics) {
    candidatesByLang.set(langId, { heuristic });
  }

  if (candidatesByLang.size === 0) {
    throw new Error('Unable to detect parser language from provided files. Specify lang explicitly.');
  }

  const resolutions: Array<{ plugin: ParserPlugin; detection?: ParserDetectionResult; score: number }> = [];

  for (const [langId, meta] of candidatesByLang) {
    let plugin: ParserPlugin;
    try {
      plugin = await loadParserPlugin(langId);
    } catch (err) {
      continue;
    }

    let detection: ParserDetectionResult | undefined;
    if (detect && typeof plugin.detect === 'function') {
      try {
        const result = plugin.detect(files);
        if (result) detection = { ...result, lang: normalizeLang(plugin.lang) };
      } catch (e) {
        // ignore detection errors and rely on heuristics
      }
    }
    if (!detection && meta.heuristic) {
      detection = meta.heuristic.detection;
    } else if (detection && meta.heuristic) {
      // merge matched files if plugin detection doesn't provide them
      if (!detection.matchedFiles || detection.matchedFiles.length === 0) {
        detection = {
          ...detection,
          matchedFiles: meta.heuristic.detection.matchedFiles,
        };
      }
      if (!detection.reason && meta.heuristic.detection.reason) {
        detection = {
          ...detection,
          reason: meta.heuristic.detection.reason,
        };
      }
    }

    const score = scoreConfidence(detection?.confidence) * 100 + (meta.heuristic?.count ?? 0);
    resolutions.push({ plugin, detection, score });
  }

  if (resolutions.length === 0) {
    const hinted = Array.from(candidatesByLang.keys());
    if (hinted.length) {
      throw new Error(`No parser plugin available for detected languages: ${hinted.join(', ')}`);
    }
    throw new Error('No parser plugin could be resolved.');
  }

  resolutions.sort((a, b) => b.score - a.score);
  const best = resolutions[0];
  return { plugin: best.plugin, detection: best.detection };
}
