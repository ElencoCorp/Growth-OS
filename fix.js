const fs = require('fs');
let content = fs.readFileSync('views/homepage-dashboard.ejs', 'utf-8');
content = content.replace(
  '<div class="relative" x-data="{ locationOpen: false }">',
  '<div class="relative hidden sm:block" x-data="{ locationOpen: false }">'
);
fs.writeFileSync('views/homepage-dashboard.ejs', content, 'utf-8');
console.log('Fixed location switcher hidden sm:block.');
