/// <reference types="jest" />
import { applyRules, rule_flow_direction, rule_legacy_to_flowchart } from '../src/core/rules';

test('flow-direction inserted when missing', () => {
  const input = { mmd: 'flowchart\nA-->B', diag: 'flowchart' as const };
  const { ctx, applied } = applyRules(input, [rule_flow_direction]);
  expect({ mmd: ctx.mmd, applied }).toMatchInlineSnapshot(`
{
  "applied": [
    "flow-direction",
  ],
  "mmd": "flowchart LR\nA-->B",
}
`);
});

test('legacy graph upgraded then direction added', () => {
  const input = { mmd: 'graph\nA-->B', diag: 'flowchart' as const };
  const { ctx, applied } = applyRules(input, [rule_legacy_to_flowchart, rule_flow_direction]);
  expect({ mmd: ctx.mmd, applied }).toMatchInlineSnapshot(`
{
  "applied": [
    "legacy-syntax-upgrade",
    "flow-direction",
  ],
  "mmd": "flowchart LR\nA-->B",
}
`);
});