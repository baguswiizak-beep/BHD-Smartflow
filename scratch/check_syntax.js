const fs = require('fs');

function checkBraces(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const startTag = '<script>';
    const endTag = '</script>';

    let startPos = content.indexOf(startTag);
    while (startPos !== -1) {
        const endPos = content.indexOf(endTag, startPos);
        if (endPos === -1) {
            console.log(`Error: Missing ${endTag}`);
            return;
        }

        const scriptContent = content.substring(startPos + startTag.length, endPos);
        const stack = [];
        let inString = null;
        let isEscaped = false;

        for (let i = 0; i < scriptContent.length; i++) {
            const char = scriptContent[i];
            
            if (isEscaped) {
                isEscaped = false;
                continue;
            }
            if (char === '\\') {
                isEscaped = true;
                continue;
            }

            if (inString) {
                if (char === inString) inString = null;
                continue;
            }

            if (char === "'" || char === '"' || char === '`') {
                inString = char;
                continue;
            }

            if (char === '{') {
                stack.push({ char, i });
            } else if (char === '}') {
                if (stack.length === 0) {
                    console.log(`Error: Unmatched '}' at script index ${i}`);
                    console.log(`Context: ...${scriptContent.substring(Math.max(0, i - 40), Math.min(scriptContent.length, i + 40))}...`);
                    return;
                }
                stack.pop();
            }
        }

        if (stack.length > 0) {
            const last = stack.pop();
            console.log(`Error: Unmatched '{' at script index ${last.i}`);
            console.log(`Context: ...${scriptContent.substring(Math.max(0, last.i - 40), Math.min(scriptContent.length, last.i + 40))}...`);
            return;
        }

        console.log("Done checking one script tag. No brace mismatch found.");
        startPos = content.indexOf(startTag, endPos);
    }
}

checkBraces(process.argv[2]);
