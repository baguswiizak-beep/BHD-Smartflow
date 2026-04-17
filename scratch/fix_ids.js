const fs = require('fs');
const path = 'c:\\Users\\USER\\Downloads\\BHD\\index.html';
let content = fs.readFileSync(path, 'utf8');

// Replace find / filter functions for sparepartStock and fleetData
content = content.replace(/\.find\(s=>s\.id===spId\)/g, ".find(s=>String(s.id)===String(spId))");
content = content.replace(/\.find\(s=>s\.id===editId\)/g, ".find(s=>String(s.id)===String(editId))");
content = content.replace(/\.find\(s=>s\.id===id\)/g, ".find(s=>String(s.id)===String(id))");
content = content.replace(/\.filter\(s => s\.id !== id\)/g, ".filter(s => String(s.id) !== String(id))");
content = content.replace(/\.find\(x=>x\.id===id\)/g, ".find(x=>String(x.id)===String(id))");
content = content.replace(/\.find\(f=>f\.id===val\)/g, ".find(f=>String(f.id)===String(val))");
content = content.replace(/\.find\(f=>f\.id===id\)/g, ".find(f=>String(f.id)===String(id))");
content = content.replace(/\.find\(t=>t\.id===prefill\.id\)/g, ".find(t=>String(t.id)===String(prefill.id))");

// Also replace installed find
content = content.replace(/\.find\(i=>i\.id==installId\)/g, ".find(i=>String(i.id)===String(installId))");

fs.writeFileSync(path, content, 'utf8');
console.log('Script execution complete');
