const { readFileSync } = require('fs');
const content = readFileSync('src/components/sanguosha/SanGuoShaControls.tsx', 'utf8');
const lines = content.split('\n');
let i = 0;
while (i < lines.length) {
  if (lines[i].includes('export const SanGuoShaControls')) {
    console.log(lines.slice(i, i+15).join('\n'));
    break;
  }
  i++;
}
