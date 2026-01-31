import test from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from '../pipeline';
import { clearParserPlugins, registerParserPlugin } from '../parsers';
import type { ParserPlugin, IRProject, IRModule, IRFunction } from '@diagrammender/types';
import { composeMermaid } from '@diagrammender/emitters-mermaid';

function createStubProject(): IRProject {
  const mainFn: IRFunction = {
    id: 'demo.main',
    name: 'main',
    params: [],
    body: [
      { kind: 'expr', text: 'widget = Widget()', pos: { file: 'demo/app.demo', line: 5 } },
      { kind: 'expr', text: 'widget.render()', pos: { file: 'demo/app.demo', line: 6 } },
    ],
    calls: ['demo.Widget.render'],
    pos: { file: 'demo/app.demo', line: 4 },
  };

  const renderFn: IRFunction = {
    id: 'demo.Widget.render',
    name: 'render',
    params: [],
    body: [
      { kind: 'expr', text: 'print("render")', pos: { file: 'demo/app.demo', line: 9 } },
    ],
    calls: [],
    pos: { file: 'demo/app.demo', line: 8 },
  };

  const module: IRModule = {
    name: 'demo',
    path: 'demo/app.demo',
    classes: [
      {
        id: 'demo.Widget',
        name: 'Widget',
        bases: [],
        attrs: ['value'],
        methods: [renderFn],
        pos: { file: 'demo/app.demo', line: 1 },
        doc: 'Example widget',
      },
    ],
    functions: [mainFn],
    imports: [],
  };

  return { modules: { demo: module } };
}

function createStubPlugin(): ParserPlugin {
  return {
    lang: 'demo',
    version: '1.0.0',
    aliases: ['demo-lang'],
    detect: () => ({ lang: 'demo', confidence: 'high', reason: 'stub plugin' }),
    capabilities: { incremental: true },
    async parseProject() {
      const project = createStubProject();
      return JSON.parse(JSON.stringify(project));
    },
  };
}

test('runPipeline exposes raw output, fragments and trace for debugging', async () => {
  clearParserPlugins();
  const plugin = createStubPlugin();
  registerParserPlugin(plugin);

  try {
    const result = await runPipeline({ 'demo/app.demo': 'class Widget: pass' }, {
      lang: 'demo',
      diagram: 'flowchart',
    });

    assert.strictEqual(result.plugin, plugin);
    assert.ok(result.detection);
    assert.ok(result.rawCode.startsWith('flowchart TD'));
    assert.ok(result.fragments.length > 0);
    assert.ok(result.links.length > 0);
    assert.strictEqual(
      composeMermaid('flowchart', result.fragments, { links: result.links }),
      result.rawCode,
    );
    assert.ok(result.trace.some((entry) => entry.stage === 'emit'));
    assert.ok(result.ir.callGraph);
    assert.ok(result.ir.callGraph?.edges.length); // ensure analyzer ran
    assert.ok(result.fragments.some((fragment) => fragment.id === 'demo.main'));
    assert.ok(result.fragments.some((fragment) => fragment.id === 'demo.Widget.render'));
    assert.ok(
      result.links.some(
        (link) => link.fromFragment === 'demo.main' && link.toFragment === 'demo.Widget.render',
      ),
    );
  } finally {
    clearParserPlugins();
  }
});
