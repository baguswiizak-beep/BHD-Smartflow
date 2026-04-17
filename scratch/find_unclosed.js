// Cek apakah ada backtick yang tidak berpasangan di JS
const fs = require('fs');
const raw = fs.readFileSync('c:/Users/USER/Downloads/BHD/scratch/check_js.js', 'utf8');

let inSingle = false, inDouble = false;
let templateDepth = 0;
let exprDepth = []; // stack to track ${...} depth inside template
let lineNum = 1, colNum = 0;

for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  const prev = raw[i-1];
  
  if (c === '\n') { lineNum++; colNum = 0; continue; }
  colNum++;
  
  // Skip escaped chars
  if (prev === '\\' && (inSingle || inDouble || templateDepth > 0)) continue;
  
  if (!inSingle && !inDouble && templateDepth === 0) {
    if (c === "'") inSingle = true;
    else if (c === '"') inDouble = true;
    else if (c === '`') { templateDepth++; exprDepth.push(0); }
  } else if (inSingle) {
    if (c === "'") inSingle = false;
  } else if (inDouble) {
    if (c === '"') inDouble = false;
  } else if (templateDepth > 0) {
    const curExpr = exprDepth[exprDepth.length - 1];
    if (c === '`') {
      exprDepth.pop();
      templateDepth--;
    } else if (c === '$' && raw[i+1] === '{' && curExpr === 0) {
      exprDepth[exprDepth.length - 1]++;
      i++; colNum++;
    } else if (c === '{' && curExpr > 0) {
      exprDepth[exprDepth.length - 1]++;
    } else if (c === '}' && curExpr > 0) {
      exprDepth[exprDepth.length - 1]--;
      if (exprDepth[exprDepth.length - 1] < 0) {
        console.log(`WARN: Extra } at line ${lineNum}, col ${colNum}`);
        exprDepth[exprDepth.length - 1] = 0;
      }
    } else if (c === '`') {
      // Nested template (shouldn't happen without ${)
      console.log(`WARN: unexpected backtick at line ${lineNum}, col ${colNum}`);
    }
  }
}

console.log(`Final state: inSingle=${inSingle}, inDouble=${inDouble}, templateDepth=${templateDepth}`);
console.log(`exprDepth stack: ${JSON.stringify(exprDepth)}`);
if (templateDepth !== 0) console.log('ERROR: Unclosed template literal!');
else if (inSingle || inDouble) console.log('ERROR: Unclosed string literal!');
else console.log('All strings appear balanced');
