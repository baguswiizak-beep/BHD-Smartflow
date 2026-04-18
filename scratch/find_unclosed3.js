const fs = require('fs');
const raw = fs.readFileSync('c:/Users/USER/Downloads/BHD/scratch/check_js.js', 'utf8');

let inSingle = false, inDouble = false;
let templateDepth = 0;
let exprDepth = [];
let lineNum = 1, colNum = 0;
let lastOpenSingle = null, lastOpenDouble = null;

for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  const prev = i > 0 ? raw[i-1] : '';
  
  if (c === '\n') { lineNum++; colNum = 0; continue; }
  colNum++;
  
  // Skip escaped chars
  if (prev === '\\') {
    if (inSingle || inDouble || templateDepth > 0) continue;
  }
  
  if (!inSingle && !inDouble && templateDepth === 0) {
    if (c === "'") { inSingle = true; lastOpenSingle = {line: lineNum, col: colNum}; }
    else if (c === '"') { inDouble = true; lastOpenDouble = {line: lineNum, col: colNum}; }
    else if (c === '`') { templateDepth++; exprDepth.push(0); }
  } else if (inSingle) {
    if (c === "'") { inSingle = false; lastOpenSingle = null; }
  } else if (inDouble) {
    if (c === '"') { inDouble = false; lastOpenDouble = null; }
  } else if (templateDepth > 0) {
    const curExpr = exprDepth[exprDepth.length - 1];
    if (c === '`' && curExpr === 0) {
      exprDepth.pop(); templateDepth--;
    } else if (c === '$' && raw[i+1] === '{' && curExpr === 0) {
      exprDepth[exprDepth.length - 1]++; i++; colNum++;
    } else if (c === '{' && curExpr > 0) {
      exprDepth[exprDepth.length - 1]++;
    } else if (c === '}' && curExpr > 0) {
      exprDepth[exprDepth.length - 1]--;
    }
  }
}

console.log(`Final: inSingle=${inSingle}, inDouble=${inDouble}, template=${templateDepth}`);
if (lastOpenSingle) {
  console.log(`UNCLOSED SINGLE QUOTE at line ${lastOpenSingle.line}`);
  const lines = raw.split('\n');
  const start = Math.max(0, lastOpenSingle.line - 2);
  const end = Math.min(lines.length-1, lastOpenSingle.line + 2);
  for (let i = start; i <= end; i++) {
    const marker = i === lastOpenSingle.line - 1 ? '>>>' : '   ';
    console.log(marker, i+1, ':', lines[i].substring(0, 150));
  }
}
if (lastOpenDouble) {
  console.log(`UNCLOSED DOUBLE QUOTE at line ${lastOpenDouble.line}`);
}
