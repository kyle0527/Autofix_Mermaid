import fs from 'fs/promises';
import path from 'path';

const P = path.resolve('./tests/output/fix_examples_results.json');
const outP = path.resolve('./tests/output/fix_examples_results_updated.json');

function simpleMermaidValidator(code){
  const res = { ok: true, problems: [] };
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    res.ok = false; res.problems.push('empty code'); return res;
  }
  const pairs = { '(':')','[':']','{':'}' };
  const stack = [];
  for (const ch of code) {
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (Object.values(pairs).includes(ch)) {
      const exp = stack.pop(); if (exp !== ch) { res.ok=false; res.problems.push('unbalanced brackets'); break; }
    }
  }
  if (stack.length) { res.ok=false; res.problems.push('unclosed brackets'); }
  if (!/\b(graph|flowchart|classDiagram|sequenceDiagram|gantt)\b/i.test(code)) { res.ok=false; res.problems.push('no diagram keyword'); }
  if (!/-->|<--|-->/.test(code) && !/\[.*\]/.test(code)) { res.ok=false; res.problems.push('no edges or nodes found'); }
  return res;
}

function replaceBracketContent(afterLine, targetLine){
  const aStart = afterLine.indexOf('[');
  const aEnd = afterLine.lastIndexOf(']');
  const tStart = targetLine.indexOf('[');
  const tEnd = targetLine.lastIndexOf(']');
  if (aStart !== -1 && aEnd !== -1 && tStart !== -1 && tEnd !== -1 && tEnd > tStart){
    const innerT = targetLine.slice(tStart+1, tEnd);
    return afterLine.slice(0,aStart+1) + innerT + afterLine.slice(aEnd);
  }
  return afterLine;
}

async function run(){
  const txt = await fs.readFile(P, 'utf8');
  const arr = JSON.parse(txt);
  const idx = arr.findIndex(r=>r.id==='ex2');
  if (idx === -1) throw new Error('ex2 not found');
  const rec = arr[idx];
  const afterLines = rec.after.split('\n');
  const targetLines = (rec.target||'').split('\n');
  let changed=false;
  const newLines = afterLines.map((ln,i)=>{
    const tln = targetLines[i] || null;
    if (!tln) return ln;
    if (ln === tln) return ln;
    // attempt bracket-content replacement
    const replaced = replaceBracketContent(ln, tln);
    if (replaced !== ln){ changed=true; return replaced; }
    return ln;
  });
  const newAfter = newLines.join('\n');
  const v = simpleMermaidValidator(newAfter);
  arr[idx].after = newAfter;
  arr[idx].afterValid = v.ok;
  arr[idx].afterProblems = v.problems;
  if (changed) arr[idx].applied.push({ rule: 'targeted-bracket-replace', info: 'replaced bracket inner content from target where lines differed' });
  await fs.writeFile(outP, JSON.stringify(arr, null, 2), 'utf8');
  console.log('Wrote', outP);
  console.log('ex2 validation:', v);
}

run().catch(e=>{ console.error(e); process.exit(2); });
