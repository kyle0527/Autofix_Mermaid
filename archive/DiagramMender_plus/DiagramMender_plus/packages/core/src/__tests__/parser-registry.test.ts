import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearParserPlugins,
  registerParserPlugin,
  loadParserPlugin,
  listParserPlugins,
  resolveParserPlugin,
} from '../parsers';
import type { ParserPlugin } from '@diagrammender/types';

function createStubPlugin(name: string, aliases: string[] = []): ParserPlugin {
  return {
    lang: name,
    version: '0.0.1',
    aliases,
    parseProject: async () => ({ modules: {}, fixNotes: [] }),
  };
}

test('registerParserPlugin stores aliases and resolves via loader', async () => {
  clearParserPlugins();
  const plugin = createStubPlugin('demo', ['demo-alt']);
  registerParserPlugin(plugin);

  const loaded = await loadParserPlugin('demo-alt');
  assert.strictEqual(loaded, plugin);

  const plugins = listParserPlugins();
  assert.strictEqual(plugins.length, 1);
  assert.strictEqual(plugins[0], plugin);
});

test('loadParserPlugin throws for unknown languages', async () => {
  clearParserPlugins();
  await assert.rejects(loadParserPlugin('unknown-lang'), /Parser plugin not found/);
});

test('resolveParserPlugin auto-detects using heuristics when lang is omitted', async () => {
  clearParserPlugins();
  const plugin = createStubPlugin('python');
  registerParserPlugin(plugin);

  const { plugin: resolved, detection } = await resolveParserPlugin({
    files: { 'src/app.py': 'def main():\n  return 0\n' },
  });

  assert.strictEqual(resolved, plugin);
  assert.ok(detection);
  assert.strictEqual(detection?.lang, 'python');
  assert.strictEqual(detection?.confidence, 'high');
  assert.ok(detection?.matchedFiles?.includes('src/app.py'));
});

test('resolveParserPlugin uses candidate languages when heuristics are unavailable', async () => {
  clearParserPlugins();
  const plugin = createStubPlugin('demo');
  plugin.detect = () => ({ lang: 'demo', confidence: 'medium', reason: 'mock-detect' });
  registerParserPlugin(plugin);

  const { plugin: resolved, detection } = await resolveParserPlugin({
    lang: 'auto',
    files: { 'README.md': '# demo project' },
    candidates: ['demo'],
  });

  assert.strictEqual(resolved, plugin);
  assert.ok(detection);
  assert.strictEqual(detection?.lang, 'demo');
  assert.strictEqual(detection?.confidence, 'medium');
});

test('resolveParserPlugin requires files when language is auto', async () => {
  clearParserPlugins();
  await assert.rejects(
    resolveParserPlugin({ lang: 'auto' }),
    /requires files/,
  );
});
