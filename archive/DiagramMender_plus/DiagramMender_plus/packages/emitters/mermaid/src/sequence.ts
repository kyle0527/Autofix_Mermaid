import { IRProject, MermaidFragment } from '@diagrammender/types';
import { composeMermaid } from './compose';

function safeId(label: string): string {
  return label.split('.').join('_');
}

export function emitSequenceFragments(ir: IRProject): MermaidFragment[] {
  const participantLines: string[] = [];
  const seenParticipants = new Set<string>();
  for (const mod of Object.values(ir.modules)) {
    for (const fn of mod.functions) {
      const caller = `${mod.name}.${fn.name}`;
      if (!seenParticipants.has(caller)) {
        participantLines.push(`participant ${safeId(caller)} as ${caller}`);
        seenParticipants.add(caller);
      }
    }
  }

  const additionalParticipants = new Set<string>();
  if (ir.callGraph) {
    for (const edge of ir.callGraph.edges) {
      if (!seenParticipants.has(edge.toName)) {
        additionalParticipants.add(edge.toName);
      }
    }
  } else {
    for (const mod of Object.values(ir.modules)) {
      for (const fn of mod.functions) {
        for (const call of fn.calls) {
          if (!seenParticipants.has(call)) {
            additionalParticipants.add(call);
          }
        }
      }
    }
  }
  for (const participant of additionalParticipants) {
    participantLines.push(`participant ${safeId(participant)} as ${participant}`);
    seenParticipants.add(participant);
  }

  const messageLines: string[] = [];
  if (ir.callGraph) {
    for (const edge of ir.callGraph.edges) {
      const from = safeId(edge.from);
      const to = safeId(edge.toId || edge.toName);
      messageLines.push(`${from}->>${to}: call()`);
    }
  } else {
    for (const mod of Object.values(ir.modules)) {
      for (const fn of mod.functions) {
        const from = safeId(`${mod.name}.${fn.name}`);
        for (const call of fn.calls) {
          messageLines.push(`${from}->>${safeId(call)}: call()`);
        }
      }
    }
  }

  const fragments: MermaidFragment[] = [];
  if (participantLines.length > 0) {
    fragments.push({
      id: 'sequence-participants',
      title: 'Participants',
      diagram: 'sequenceDiagram',
      code: participantLines.join('\n'),
    });
  }
  if (messageLines.length > 0) {
    fragments.push({
      id: 'sequence-messages',
      title: 'Messages',
      diagram: 'sequenceDiagram',
      code: messageLines.join('\n'),
    });
  }
  if (fragments.length === 0) {
    fragments.push({
      id: 'sequence-empty',
      title: 'empty',
      diagram: 'sequenceDiagram',
      code: 'Note over X: no data',
    });
  }
  return fragments;
}

export function emitSequenceDiagram(ir: IRProject): string {
  return composeMermaid('sequenceDiagram', emitSequenceFragments(ir));
}
