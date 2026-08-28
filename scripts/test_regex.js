const fs = require('fs');
const path = require('path');

const rawHtmlPath = path.join(__dirname, '..', 'public', 'raw_user_html.html');
const rawHtml = fs.readFileSync(rawHtmlPath, 'utf8');

console.log('--- RAW HTML TEST ---');
console.log('Includes Ocultar Ciclo:', rawHtml.includes('Ocultar Ciclo'));
console.log('Includes Ocultar verdes:', rawHtml.includes('Ocultar verdes'));
console.log('Includes btnCiclo:', rawHtml.includes('btnCiclo'));

let finalHtml = rawHtml;

// Apply replacements
finalHtml = finalHtml.replace(/<button[^>]*>[\s\S]*?Ocultar\s+Ciclo[\s\S]*?<\/button>/gi, '');
finalHtml = finalHtml.replace(/<button[^>]*>[\s\S]*?Ocultar\s+verdes[\s\S]*?<\/button>/gi, '');
finalHtml = finalHtml.replace(/<button[^>]*\bid=["']?btnCiclo["']?[^>]*>[\s\S]*?<\/button>/gi, '');
finalHtml = finalHtml.replace(/<button[^>]*\bid=["']?btnVerdes["']?[^>]*>[\s\S]*?<\/button>/gi, '');
finalHtml = finalHtml.replace(/<button[^>]*toggleCol\(['"]ciclo['"]\)[\s\S]*?<\/button>/gi, '');
finalHtml = finalHtml.replace(/<button[^>]*toggleVerdes\(\)[\s\S]*?<\/button>/gi, '');

// Generic string replacement fallback as well
finalHtml = finalHtml.replace(/Ocultar Ciclo/gi, '');
finalHtml = finalHtml.replace(/Ocultar verdes/gi, '');

console.log('\n--- AFTER REPLACEMENT ---');
console.log('Includes Ocultar Ciclo:', finalHtml.includes('Ocultar Ciclo'));
console.log('Includes Ocultar verdes:', finalHtml.includes('Ocultar verdes'));
console.log('Includes btnCiclo:', finalHtml.includes('btnCiclo'));
