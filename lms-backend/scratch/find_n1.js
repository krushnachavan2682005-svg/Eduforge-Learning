const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src/modules').filter(f => f.endsWith('.ts'));
let n1Candidates = [];

files.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/(for\s*\(|forEach\(|\.map\(|Promise\.all\()/)) {
            let j = i;
            let block = '';
            let open = 0;
            let foundBracket = false;
            
            do {
                if (j >= lines.length || j > i + 30) break;
                
                block += lines[j] + '\n';
                if (lines[j].includes('{')) {
                    open++;
                    foundBracket = true;
                }
                if (lines[j].includes('}')) open--;
                
                j++;
            } while(!foundBracket || (open > 0));

            if (block.match(/await\s+.*\.(findOne|findAll|findByPk|count|create|update|destroy)/) ||
                block.match(/await\s+.*Repository/) ||
                block.match(/await\s+.*\.(get[A-Z]\w*)\(/) ||
                block.match(/sequelize\.query\(/)) {
                n1Candidates.push({
                    file: f,
                    line: i + 1,
                    block: block
                });
            }
        }
    }
});

if (!fs.existsSync('scratch')) {
    fs.mkdirSync('scratch');
}

fs.writeFileSync('scratch/n1_audit.json', JSON.stringify(n1Candidates, null, 2));
console.log('Found ' + n1Candidates.length + ' potential N+1 loops');
