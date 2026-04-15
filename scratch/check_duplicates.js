const fs = require('fs');

function checkDuplicateDeclarations(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const startTag = '<script>';
    const endTag = '</script>';

    let startPos = content.indexOf(startTag);
    while (startPos !== -1) {
        const endPos = content.indexOf(endTag, startPos);
        if (endPos === -1) break;

        const scriptContent = content.substring(startPos + startTag.length, endPos);
        const declarations = {};
        
        // Very basic regex to find let/const/function declarations
        const regex = /(?:let|const|var|function)\s+([a-zA-Z0-9_$]+)/g;
        let match;
        while ((match = regex.exec(scriptContent)) !== null) {
            const name = match[1];
            if (declarations[name]) {
                console.log(`Duplicate found: ${name} (matched at index ${match.index})`);
            }
            declarations[name] = true;
        }

        startPos = content.indexOf(startTag, endPos);
    }
}

checkDuplicateDeclarations(process.argv[2]);
