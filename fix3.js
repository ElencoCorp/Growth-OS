const fs = require('fs');
let content = fs.readFileSync('views/homepage-dashboard.ejs', 'utf-8');

// Replace the Alpine.$persist line with plain darkMode: false
content = content.replace(
  'darkMode: Alpine.$persist(false),',
  'darkMode: false,'
);

// Inject localStorage logic into init()
content = content.replace(
  'init() {',
  "init() {\n                    this.darkMode = localStorage.getItem('darkMode') === 'true';\n                    this.$watch('darkMode', val => localStorage.setItem('darkMode', val));"
);

fs.writeFileSync('views/homepage-dashboard.ejs', content, 'utf-8');
console.log('Fixed Alpine state using manual localStorage.');
