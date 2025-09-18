"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitSequenceFragments = emitSequenceFragments;
exports.emitSequenceDiagram = emitSequenceDiagram;
const compose_1 = require("./compose");
function safeId(label) {
    return label.split('.').join('_');
}
function emitSequenceFragments(ir) {
    const participantLines = [];
    const seenParticipants = new Set();
    for (const mod of Object.values(ir.modules)) {
        for (const fn of mod.functions) {
            const caller = `${mod.name}.${fn.name}`;
            if (!seenParticipants.has(caller)) {
                participantLines.push(`participant ${safeId(caller)} as ${caller}`);
                seenParticipants.add(caller);
            }
        }
    }
    const additionalParticipants = new Set();
    if (ir.callGraph) {
        for (const edge of ir.callGraph.edges) {
            if (!seenParticipants.has(edge.toName)) {
                additionalParticipants.add(edge.toName);
            }
        }
    }
    else {
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
    const messageLines = [];
    if (ir.callGraph) {
        for (const edge of ir.callGraph.edges) {
            const from = safeId(edge.from);
            const to = safeId(edge.toId || edge.toName);
            messageLines.push(`${from}->>${to}: call()`);
        }
    }
    else {
        for (const mod of Object.values(ir.modules)) {
            for (const fn of mod.functions) {
                const from = safeId(`${mod.name}.${fn.name}`);
                for (const call of fn.calls) {
                    messageLines.push(`${from}->>${safeId(call)}: call()`);
                }
            }
        }
    }
    const fragments = [];
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
function emitSequenceDiagram(ir) {
    return (0, compose_1.composeMermaid)('sequenceDiagram', emitSequenceFragments(ir));
}
