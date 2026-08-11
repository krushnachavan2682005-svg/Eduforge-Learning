const fs = require('fs');
const path = require('path');

const dir = 'd:/Personal Projects/Eduforge Learning/lms-frontend/src';

function walkDir(currentPath) {
    const files = fs.readdirSync(currentPath);
    for (const file of files) {
        const fullPath = path.join(currentPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.html')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('/eduforge/api')) {
                const newContent = content.replace(/\/eduforge\/api/g, '');
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

walkDir(dir);
console.log('Done replacing /eduforge/api in frontend.');
