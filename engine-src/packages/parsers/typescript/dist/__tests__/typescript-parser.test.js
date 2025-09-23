"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.default)('detectTypeScriptProject identifies TS files with high confidence', () => {
    const detection = index_1.typescriptParserPlugin.detect?.({
        'src/app.ts': 'export const ok = true;',
        'package.json': '{}',
    });
    strict_1.default.ok(detection);
    strict_1.default.strictEqual(detection?.lang, 'typescript');
    strict_1.default.strictEqual(detection?.confidence, 'high');
    strict_1.default.ok(detection?.matchedFiles?.includes('src/app.ts'));
});
(0, node_test_1.default)('parseTypeScriptProject extracts entities and edges', () => {
    const files = {
        'src/service.ts': `
import type { Config } from './types';
import { helper } from './helper';

export class Service {
  constructor(private readonly config: Config) {}

  run(): number {
    helper(this.config);
    return 1;
  }
}

export function bootstrap(): void {
  const svc = new Service({} as Config);
  svc.run();
}
`,
    };
    const ir = (0, index_1.parseTypeScriptProject)(files);
    const mod = ir.modules['src.service'];
    strict_1.default.ok(mod, 'module not found');
    strict_1.default.ok(mod.imports.some((imp) => imp.includes('./helper')));
    strict_1.default.ok(mod.imports.some((imp) => imp.includes('./types')));
    const service = mod.classes.find((cls) => cls.name === 'Service');
    strict_1.default.ok(service, 'Service class missing');
    const run = service.methods.find((m) => m.name === 'run');
    strict_1.default.ok(run, 'run method missing');
    strict_1.default.ok(run.calls.includes('helper'));
    strict_1.default.ok(mod.functions.some((fn) => fn.name === 'bootstrap'));
});
(0, node_test_1.default)('parseTypeScriptProject throws on syntax errors', () => {
    strict_1.default.throws(() => {
        (0, index_1.parseTypeScriptProject)({ 'broken.ts': 'export function nope(: void { return; }' });
    }, /syntax error/i);
});
(0, node_test_1.default)('parseTypeScriptProject throws when no TS files are provided', () => {
    strict_1.default.throws(() => {
        (0, index_1.parseTypeScriptProject)({ 'README.md': '# docs' });
    }, /No TypeScript source files/);
});
