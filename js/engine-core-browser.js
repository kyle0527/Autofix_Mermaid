// Browser bundle shim for core complexity & rules
// NOTE: This is a lightweight bridge; for production consider a proper bundler.
import '../src/core/complexity.ts';
import { applyRules, rule_legacy_to_flowchart, rule_flow_direction, rule_id_normalize } from '../src/core/rules.ts';

export { applyRules, rule_legacy_to_flowchart, rule_flow_direction, rule_id_normalize };
