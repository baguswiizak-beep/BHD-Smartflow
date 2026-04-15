const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const scriptOpens = content.match(/<script>/g) || [];
const scriptCloses = content.match(/<\/script>/g) || [];

console.log('Script Opens:', scriptOpens.length);
console.log('Script Closes:', scriptCloses.length);

let openPos = -1;
let i = 0;
while ((openPos = content.indexOf('<script>', openPos + 1)) !== -1) {
  console.log(`Script ${++i} opens at line`, content.substring(0, openPos).split('\n').length);
  let closePos = content.indexOf('</script>', openPos);
  if (closePos === -1) {
    console.log(`  ERROR: No closing tag found for script ${i}`);
  } else {
    console.log(`  Closes at line`, content.substring(0, closePos).split('\n').length);
    openPos = closePos;
  }
}
