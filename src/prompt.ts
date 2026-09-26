import type { CharacterCognitionInput, CognitionSnapshot } from './types.js';

export function formatCognition(input: CharacterCognitionInput, result: CognitionSnapshot): string {
  const byId = new Map(input.candidates.map(candidate => [candidate.id, candidate]));
  const lines = result.salientEvidence.flatMap(item => {
    const candidate = byId.get(item.candidateId);
    return candidate ? [`- [${candidate.id}; ${candidate.epistemicStatus}] ${candidate.content.replace(/[\r\n]+/g, ' ').slice(0, 400)}`] : [];
  });
  return [
    '<omnia_character_cognition>',
    `Private, ephemeral guidance for ${input.character.name}. Do not quote this block.`,
    'Salient source material (utterances are claims, not proven world facts):',
    ...lines,
    ...(result.responseTendency ? [`Response tendency: ${result.responseTendency.strategy}. Realize it naturally, without rigid wording.`] : []),
    'Do not grant the character knowledge absent from their sources. Do not turn interpretations into objective facts.',
    '</omnia_character_cognition>',
  ].join('\n');
}
