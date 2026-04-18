// Use Node.js built-in Function constructor which IS the real V8 parser
const fs = require('fs');
const jsCode = fs.readFileSync('c:/Users/USER/Downloads/BHD/scratch/check_js.js', 'utf8');

// Try to parse with V8 (same engine as Chrome)
try {
  // We wrap in 'use strict' to catch more errors
  new Function('"use strict";\n' + jsCode);
  console.log('SUCCESS: No syntax errors detected by V8');
} catch(e) {
  console.log('SYNTAX ERROR found by V8:');
  console.log(e.message);
  
  // Binary search for exact line
  const lines = jsCode.split('\n');
  let lo = 0, hi = lines.length;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    try {
      new Function('"use strict";\n' + lines.slice(0, mid).join('\n'));
      lo = mid;
    } catch(e2) {
      hi = mid;
    }
  }
  console.log(`\nError first occurs around extracted-JS line ${lo+1} to ${hi+1}`);
  const start = Math.max(0, lo-3);
  const end = Math.min(lines.length-1, hi+2);
  for (let i = start; i <= end; i++) {
    const mark = (i >= lo && i <= hi) ? '>>>' : '   ';
    console.log(mark, i+1, ':', lines[i].substring(0, 120));
  }
}
