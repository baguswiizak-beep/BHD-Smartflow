const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

// Check for common script breaking issues
console.log('File length:', content.length);

const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.log('Error: No script tag found!');
} else {
  const scriptContent = scriptMatch[1];
  console.log('Script length:', scriptContent.length);
  
  // Look for </script> inside
  let pos = scriptContent.indexOf('</script>');
  if (pos !== -1) {
    console.log('DANGER: Found unescaped </script> at position', pos);
    console.log('Context:', scriptContent.substring(pos-20, pos+20));
  } else {
    console.log('No unescaped </script> found.');
  }
}
