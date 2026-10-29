// Builds data/dock-notes.json from the audited trivia bank (games/trivia/data/questions.json).
// Run from the repo root: node games/fishing/tools/make-notes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bank = JSON.parse(fs.readFileSync(path.join(here, '../../trivia/data/questions.json'), 'utf8'));
const IDS = ['hs-0121', 'hs-0122', 'hs-0123', 'hs-0124', 'hs-0126', 'hs-0127', 'hs-0128', 'hs-0130', 'hs-0131',
  'hs-0132', 'hs-0134', 'hs-0135', 'hs-0136', 'hs-0137', 'hs-0138', 'hs-0139', 'hs-0140', 'hs-0141', 'hs-0143',
  'hs-0144', 'hs-0159', 'hs-0169', 'hs-0173', 'hs-0174', 'hs-0175', 'hs-0176', 'hs-0177', 'hs-0178', 'hs-0179', 'hs-0170'];
// Record holders and tournament anglers are private people: never shown (town-content §6).
const OVERRIDE = { 'hs-0134': 'It was caught at Greers Ferry Lake on March 12, 1982.' };
const byId = new Map(bank.questions.map((q) => [q.id, q]));
const notes = IDS.map((id) => {
  const q = byId.get(id);
  if (!q) throw new Error('missing ' + id);
  return { id, q: q.question, a: q.answer, text: OVERRIDE[id] || q.explanation, source: q.source, claim: q.confidence === 'claim' };
});
fs.writeFileSync(path.join(here, '../data/dock-notes.json'), JSON.stringify({ from: 'games/trivia/data/questions.json', notes }, null, 1));
console.log('wrote', notes.length, 'notes');
