const fs = require('fs');
const file = 'src/app/services/common-http.service.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.split('\/members').join('\/members/members');
content = content.split('\/roles').join('\/members/roles');
content = content.split('\/permissions').join('\/members/permissions');

fs.writeFileSync(file, content);
console.log('done');
