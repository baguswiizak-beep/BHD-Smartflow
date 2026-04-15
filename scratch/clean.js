const fs = require('fs');
const path = 'c:\\Users\\USER\\Downloads\\BHD\\index.html';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);
const output = [];
let skip = false;

for (const line of lines) {
    if (line.startsWith('<<<<<<<')) {
        skip = true;
        continue;
    }
    if (line.startsWith('=======')) {
        skip = false;
        continue;
    }
    if (line.startsWith('>>>>>>>')) {
        continue;
    }
    if (!skip) {
        output.push(line);
    }
}

fs.writeFileSync(path + '.cleaned', output.join('\n'), 'utf8');
console.log('Cleanup complete. File saved to index.html.cleaned');
