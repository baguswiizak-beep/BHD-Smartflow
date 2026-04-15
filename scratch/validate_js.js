const fs = require('fs');
const { execSync } = require('child_process');

function checkSyntax(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const startTag = '<script>';
    const endTag = '</script>';

    let startPos = content.indexOf(startTag);
    while (startPos !== -1) {
        const endPos = content.indexOf(endTag, startPos);
        if (endPos === -1) break;

        const scriptContent = content.substring(startPos + startTag.length, endPos);
        fs.writeFileSync('temp_script.js', scriptContent);
        
        try {
            execSync('node --check temp_script.js');
            console.log("No syntax errors found in this script tag.");
        } catch (e) {
            console.log("Syntax Error found:");
            console.log(e.stderr.toString());
        }

        startPos = content.indexOf(startTag, endPos);
    }
}

checkSyntax(process.argv[2]);
