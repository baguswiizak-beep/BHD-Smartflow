const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\USER\\Downloads\\BHD\\index.html', 'utf8');

let openBraces = 0;
let closeBraces = 0;
let stack = [];

for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') {
    openBraces++;
    stack.push(i);
  } else if (content[i] === '}') {
    closeBraces++;
    if (stack.length === 0) {
      console.log('Excess closing brace at index ' + i);
    } else {
      stack.pop();
    }
  }
}

console.log('Open: ' + openBraces);
console.log('Close: ' + closeBraces);
console.log('Diff: ' + (openBraces - closeBraces));

if (stack.length > 0) {
  console.log('Unclosed braces at indices: ' + stack);
  const start = Math.max(0, stack[0] - 100);
  const end = Math.min(content.length, stack[0] + 200);
  console.log('Context for first unclosed brace:\n' + content.substring(start, end));
}
