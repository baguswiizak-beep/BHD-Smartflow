// Use acorn to properly find syntax errors in the extracted JS
// First try without acorn, and use function-based parsing approach

const fs = require('fs');
let jsCode = fs.readFileSync('c:/Users/USER/Downloads/BHD/scratch/check_js.js', 'utf8');

// Wrap in IIFE to isolate global scope issues
// Strategy: binary search for the problematic section
const lines = jsCode.split('\n');
const total = lines.length;
console.log('Total JS lines:', total);

// Try to find the error by bisecting
function tryParse(code) {
  try {
    new Function(code);
    return null;
  } catch(e) {
    return e.message;
  }
}

// Try the full code
let result = tryParse(jsCode);
if (!result) {
  console.log('No syntax errors found!');
  process.exit(0);
}
console.log('Full code error:', result);

// Binary search 
let lo = 0, hi = total;
while (lo < hi - 1) {
  const mid = Math.floor((lo + hi) / 2);
  const segment = lines.slice(0, mid).join('\n');
  const err = tryParse(segment);
  if (err) {
    hi = mid;
  } else {
    lo = mid;
  }
}
console.log('Error first appears around line', lo+1, 'to', hi+1);
console.log('Lines around error:');
for (let i = Math.max(0, lo-2); i <= Math.min(total-1, hi+2); i++) {
  console.log(i+1, ':', lines[i]);
}
