import { applyRules, rule_flow_direction, rule_legacy_to_flowchart, rule_id_normalize } from '../src/core/rules';

const diagrams: string[] = [
// 1
`flowchart TD
    n0([ Start: run_checks.py module ])
    n1([ End / 結束 ])
    n2["Import / 導入"]
    n3["ImportFrom / 導入自"]
    n4["sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))"]
    n5["ImportFrom / 導入自"]
    n6["def main... / 定義"]
    n7{"if __name__ == '__main__' / 如果 __name__ == '__main__'"}
    n8["main() / main()"]
    n9["merge / 合併"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 --> n7
    n7 -->|True| n8
    n7 -->|False| n9
    n8 --> n9
    n9 --> n1`,
// 2
`flowchart TD
    n0([" Start: main() / Start: main() "])
    n1([" End / 結束 "])
    n2["ap = argparse.ArgumentParser() / ap = argparse.ArgumentParser()"]
    n3["ap.add_argument('--in', dest='infile', required=False, help='path to apis.json') / ap.add_argument('--in', dest='infile', required=False, help='path to apis.json')"]
    n4["ap.add_argument('--checks', default='idor,oauth') / ap.add_argument('--checks', default='idor,oauth')"]
    n5["ap.add_argument('--out', dest='outfile', default='out/findings.jsonl') / ap.add_argument('--out', dest='outfile', default='out/findings.jsonl')"]
    n6["args = ap.parse_args() / args = ap.parse_args()"]
    n7["checks = [c.strip() for c in args.checks.split(',') if c.strip()] / checks = [c.strip() for c in args.checks.split(',') if c.strip()]"]
    n8["classes = [REGISTRY[c] for c in checks if c in REGISTRY] / classes = [REGISTRY[c] for c in checks if c in REGISTRY]"]
    n9["apis = None / apis = None"]
    n10{"if args.infile / 如果 args.infile"}
    n11["try / 嘗試"]
    n12["With / With"]
    n13["except Exception / 例外"]
    n14["apis = None / apis = None"]
    n15["after try / try 後"]
    n16["merge / 合併"]
    n17["out_lines: List[str] = [] / out_lines: List[str] = []"]
    n18{"for Cls in classes / for Cls in classes"}
    n19["inst = Cls() / inst = Cls()"]
    n20{"for finding in inst.run(apis=apis) / for finding in inst.run(apis=apis)"}
    n21["out_lines.append(finding.to_json()) / out_lines.append(finding.to_json())"]
    n22["after for / for 後"]
    n23["after for / for 後"]
    n24["Import / 導入"]
    n25["os.makedirs(os.path.dirname(args.outfile), exist_ok=True) / os.makedirs(os.path.dirname(args.outfile), exist_ok=True)"]
    n26["With / With"]
    n27["print(f'wrote {len(out_lines)} findings to {args.outfile}') / print(f'wrote {len(out_lines)} findings to {args.outfile}')"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 --> n7
    n7 --> n8
    n8 --> n9
    n9 --> n10
    n10 -->|True| n11
    n10 -->|False| n16
    n11 --> n12
    n11 --> n13
    n12 --> n15
    n13 --> n14
    n14 --> n15
    n15 --> n16
    n16 --> n17
    n17 --> n18
    n18 -->|True| n19
    n18 -->|False| n23
    n19 --> n20
    n20 -->|True| n21
    n20 -->|False| n22
    n21 --> n20
    n22 --> n18
    n23 --> n24
    n24 --> n25
    n25 --> n26
    n26 --> n27
    n27 --> n1`,
// 3
`flowchart TD
    n0(["Start: scorecard.py (module) / Start: scorecard.py (module)"])
    n1(["End / 結束"])
    n2["Import / 導入"]
    n3["WEIGHTS = {'discovery': 0.2, 'protocol': 0.25, 'verification': 0.15, 'ranking': 0.1, 'delivery': 0.1, 'ecosystem': 0.1, 'compliance': 0.05, 'performance': 0.05} / WEIGHTS = {'discovery': 0.2, 'protocol': 0.25, 'verification': 0.15, 'ranking': 0.1, 'delivery': 0.1, 'ecosystem': 0.1, 'compliance': 0.05, 'performance': 0.05}"]
    n4["def score(...) / 定義"]
    n5["def main(...) / 定義"]
    n6{"if __name__ == '__main__' / 如果 __name__ == '__main__'"}
    n7["main() / main()"]
    n8["merge / 合併"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 -->|True| n7
    n6 -->|False| n8
    n7 --> n8
    n8 --> n1`,
// 4
`flowchart TD
    n0["Start: post_rank(ranked)"]
    n1["End / 結束"]
    n2["Tag findings created by :func:\`vector_probe\`."]
    n3{"for item in ranked"}
    n4{"if item.get('check') == 'demo/entrypoint'"}
    n5["item.setdefault('tags', []).append('entrypoint-demo')"]
    n6["merge"]
    n7["after for"]
    n8["return ranked"]
    n0 --> n2
    n2 --> n3
    n3 -->|True| n4
    n3 -->|False| n7
    n4 -->|True| n5
    n4 -->|False| n6
    n5 --> n6
    n6 --> n3
    n7 --> n8
    n8 --> n1`,
// 5
`flowchart TD
    n0[Start: artifact_exporter workdir, ranked]
    n1[End / 結束]
    n2["Write a short summary that confirms the plugin executed."]
    n3["report = workdir/plugins/entrypoint_demo.txt"]
    n4["Create parent directory for the report if it doesn't exist."]
    n5["Prepare lines from ranked items with target and severity."]
    n6["Write text to the report file with lines joined by newline."]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 --> n1`,
// 6
`flowchart TD
    n0([ Start: run_checks ])
    n1([ End ])
    n2["Import"]
    n3["ImportFrom"]
    n4["sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))"]
    n5["ImportFrom"]
    n6["def main()"]
    n7{"if __name__ == '__main__'"}
    n8["main()"]
    n9["merge"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 --> n7
    n7 -->|True| n8
    n7 -->|False| n9
    n8 --> n9
    n9 --> n1`
];

describe('Example diagrams set1 snapshots', () => {
  diagrams.forEach((d, i) => {
    test(`set1 diagram #${i+1}`, () => {
      const { ctx } = applyRules({ mmd: d, diag: 'flowchart' }, [
        rule_legacy_to_flowchart,
        rule_flow_direction,
        rule_id_normalize
      ]);
      expect(ctx.mmd).toMatchSnapshot();
    });
  });
});