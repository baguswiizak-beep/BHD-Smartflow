const fs = require('fs');
const content = fs.readFileSync('c:/Users/USER/Downloads/BHD/scratch/check_js.js', 'utf8');

// Simple approach - try to parse just the function structure
// Count unbalanced braces more carefully using a state machine approach

let depth = 0;
let inString = false;
let inTemplate = 0;  
let stringChar = '';
let i = 0;
const lines = content.split('\n');
let lineNum = 0;
let charCount = 0;

for (lineNum = 0; lineNum < lines.length; lineNum++) {
  const line = lines[lineNum];
  for (let ci = 0; ci < line.length; ci++) {
    const c = line[ci];
    const next = line[ci+1];
    if (inString) {
      if (c === '\\') { ci++; continue; }  // skip escaped
      if (c === stringChar) { inString = false; stringChar = ''; }
    } else if (inTemplate > 0) {
      if (c === '\\') { ci++; continue; }
      if (c === '`') inTemplate--;
      else if (c === '$' && next === '{') { depth++; ci++; }
    } else {
      if (c === '"' || c === "'") { inString = true; stringChar = c; }
      else if (c === '`') inTemplate++;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth < 0) {
          console.log('EXTRA } at line', lineNum+1, ':', line.trim().substring(0, 80));
          depth = 0;
        }
      }
    }
  }
}

console.log('Final depth:', depth, '(should be 0)');
console.log('If depth > 0, there are unclosed blocks');
