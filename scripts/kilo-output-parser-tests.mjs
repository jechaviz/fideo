import assert from 'node:assert/strict';
import { extractKiloTextOutput, parseKiloFinalJson } from '../src/infrastructure/kiloOutputParser.js';

assert.deepEqual(parseKiloFinalJson(
  'FINAL_JSON {"summary":"ok","nextActions":[],"risks":[],"receiptMessage":"linea ok"}',
), {
  summary: 'ok',
  nextActions: [],
  risks: [],
  receiptMessage: 'linea ok',
});

const eventOutput = [
  JSON.stringify({
    type: 'text',
    part: {
      text: '```json\n{"summary":"kilo","nextActions":[],"risks":[],"receiptMessage":"Kilo real ok"}\n```',
    },
  }),
].join('\n');

assert.equal(parseKiloFinalJson(eventOutput).receiptMessage, 'Kilo real ok');
assert.equal(extractKiloTextOutput(eventOutput).includes('Kilo real ok'), true);

console.log('Kilo output parser tests passed.');
