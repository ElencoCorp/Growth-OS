const fs = require('fs');
let content = fs.readFileSync('views/homepage-dashboard.ejs', 'utf-8');

// 1. GLOBAL LAYOUT FRAMEWORK OVERHAUL
// Inject the Alpine persistent theme initializer and update the layout styling classes exactly as requested.
content = content.replace(
  /<body[^>]*>/,
  '<body class="bg-slate-50 dark:bg-[#09090B] min-h-screen text-slate-900 dark:text-white transition-colors duration-300" x-data="{ darkMode: $persist(false), ...dashboardState() }" :class="{ \'dark\': darkMode }">'
);
content = content.replace(
  /<html lang="en" class="h-full bg-slate-50">/,
  '<html lang="en" class="h-full">'
);

// 2. LIVE COMPONENT STYLING REPAIR
// Update the Shreyans greeting header line explicitly.
content = content.replace(
  /class="text-2xl font-black text-slate-900 tracking-tight mb-2"/,
  'class="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2"'
);

// We will also ensure all metric cards have the correct dark classes as explicitly asked:
// "Confirm that all content presentation cards ('bg-white') include the explicit dark overrides: dark:bg-[#111827] dark:border-[#1F2937] dark:shadow-none"
// Since most are already present, we'll just re-verify and enforce it for any missed `bg-white border-slate-200` containers that are missing `dark:`
content = content.replace(/class="([^"]*)bg-white([^"]*)"/g, (match, before, after) => {
  if (match.includes('dark:bg-') || match.includes('bg-white/')) return match; // skip if already has dark override or is a transparent bg
  let newClass = match;
  newClass = newClass.replace('bg-white', 'bg-white dark:bg-[#111827]');
  newClass = newClass.replace(/border-slate-200\/?[0-9]*(?! dark:border)/, '$& dark:border-[#1F2937]');
  newClass = newClass.replace(/shadow-sm(?! shadow-| dark:shadow)/, '$& dark:shadow-none');
  return newClass;
});

// 3. TOGGLE COMPONENT SYNCHRONIZATION
// Ensure click event is wired to cleanly alternate the state variable: @click="darkMode = !darkMode"
content = content.replace(
  /<button @click="darkMode = !darkMode" class="[^"]*" title="Toggle Dark Mode">/,
  '<button @click="darkMode = !darkMode" class="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-200" title="Toggle Dark Mode">'
);

// Clean up `dashboardState()`: remove manual darkMode management since `$persist` handles it now
content = content.replace(/\s*darkMode: false,/, '');
content = content.replace(/\s*this\.darkMode = localStorage\.getItem\('darkMode'\) === 'true';/, '');
content = content.replace(/\s*this\.\$watch\('darkMode', val => localStorage\.setItem\('darkMode', val\)\);/, '');

fs.writeFileSync('views/homepage-dashboard.ejs', content, 'utf-8');
console.log('Final specific styling applied!');
