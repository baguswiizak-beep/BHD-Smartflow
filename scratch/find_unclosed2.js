// Locate unclosed template literal - track where templateDepth goes to 1 and stays there
const fs = require('fs');
const raw = fs.readFileSync('c:/Users/USER/Downloads/BHD/scratch/check_js.js', 'utf8');

let inSingle = false, inDouble = false;
let templateDepth = 0;
let exprDepth = [];
let lineNum = 1, colNum = 0;
let lastOpenBacktick = null;

for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  const prev = i > 0 ? raw[i-1] : '';
  
  if (c === '\n') { lineNum++; colNum = 0; continue; }
  colNum++;
  
  if (prev === '\\' && (inSingle || inDouble || templateDepth > 0)) continue;
  
  if (!inSingle && !inDouble && templateDepth === 0) {
    if (c === "'") inSingle = true;
    else if (c === '"') inDouble = true;
    else if (c === '`') { 
      templateDepth++; 
      exprDepth.push(0);
      lastOpenBacktick = {line: lineNum, col: colNum};
    }
  } else if (inSingle) {
    if (c === "'") inSingle = false;
  } else if (inDouble) {
    if (c === '"') inDouble = false;
  } else if (templateDepth > 0) {
    const curExpr = exprDepth[exprDepth.length - 1];
    if (c === '`' && curExpr === 0) {
      exprDepth.pop();
      templateDepth--;
      if (templateDepth === 0) lastOpenBacktick = null;
    } else if (c === '$' && raw[i+1] === '{' && curExpr === 0) {
      exprDepth[exprDepth.length - 1]++;
      i++; colNum++;
    } else if (c === '{' && curExpr > 0) {
      exprDepth[exprDepth.length - 1]++;
    } else if (c === '}' && curExpr > 0) {
      exprDepth[exprDepth.length - 1]--;
    }
  }
}

console.log(`templateDepth at end: ${templateDepth}`);
if (lastOpenBacktick) {
  console.log(`UNCLOSED TEMPLATE LITERAL started at line ${lastOpenBacktick.line}, col ${lastOpenBacktick.col}`);
  
  // Show lines around that point
  const lines = raw.split('\n');
  const start = Math.max(0, lastOpenBacktick.line - 3);
  const end = Math.min(lines.length - 1, lastOpenBacktick.line + 3);
  console.log('\nContext:');
  for (let i = start; i <= end; i++) {
    const marker = i === lastOpenBacktick.line - 1 ? '>>>' : '   ';
    console.log(marker, i+1, ':', lines[i].substring(0, 120));
  }
}
