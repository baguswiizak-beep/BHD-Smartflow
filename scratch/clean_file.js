const fs = require('fs');
const filePath = 'c:\\Users\\USER\\Downloads\\BHD\\index.html';
const content = fs.readFileSync(filePath, 'utf8');

const endTag = '</html>';
const lastIndex = content.lastIndexOf(endTag);

if (lastIndex !== -1) {
  const cleaned = content.substring(0, lastIndex + endTag.length);
  fs.writeFileSync(filePath, cleaned, 'utf8');
  console.log('File cleaned successfully up to </html>');
} else {
  console.log('</html> tag not found!');
}
