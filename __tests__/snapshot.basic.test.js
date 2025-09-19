/// <reference types="jest" />
import { applyRules, rule_legacy_to_flowchart, rule_id_normalize } from '../src/core/rules';
describe('rules snapshot', () => {
    test('legacy graph → flowchart + id normalize', () => {
        const input = {
            mmd: 'graph TD\nA-->B\n節點C-->D',
            diag: 'flowchart'
        };
        const { ctx, applied } = applyRules(input, [
            rule_legacy_to_flowchart,
            rule_id_normalize
        ]);
        expect({ mmd: ctx.mmd, applied }).toMatchInlineSnapshot(`
{
  "applied": [
    "legacy-syntax-upgrade",
    "id-normalize",
  ],
  "mmd": "flowchart TD\nA-->B\n__C-->D",
}
`);
    });
});
