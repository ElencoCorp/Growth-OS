const fs = require('fs');
let content = fs.readFileSync('views/homepage-dashboard.ejs', 'utf-8');

// Revert body x-data to just dashboardState()
content = content.replace(
  'x-data="{ ...dashboardState(), darkMode: $persist(false) }"',
  'x-data="dashboardState()"'
);

// Inject Alpine.$persist into dashboardState
content = content.replace(
  'isExecuting: false,',
  'isExecuting: false,\n                darkMode: Alpine.$persist(false),'
);

fs.writeFileSync('views/homepage-dashboard.ejs', content, 'utf-8');
console.log('Fixed Alpine state.');
