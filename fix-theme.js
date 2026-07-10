const fs = require('fs');
let content = fs.readFileSync('views/homepage-dashboard.ejs', 'utf-8');

// 1. GLOBAL CANVAS BACKGROUND AND BODY
content = content.replace(
  /class="h-full antialiased font-sans text-slate-900([^"]+)"/,
  'class="h-full antialiased font-sans bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#09090B] dark:text-white"'
);

// 2. CARD COMPONENT INVERSIONS (Make sure Welcome Hero and others have the correct backgrounds)
content = content.replace(/bg-white border-slate-200\/60 shadow-sm/g, 'bg-white dark:bg-[#111827] border-slate-200/60 dark:border-[#1F2937] shadow-sm dark:shadow-none');
// Let's also do a blanket replacement for bg-white on metric cards if they missed it
content = content.replace(/bg-white(?!\/| dark:bg-)/g, 'bg-white dark:bg-[#111827]');
content = content.replace(/border-slate-200\/60(?! dark:border)/g, 'border-slate-200/60 dark:border-[#1F2937]');
content = content.replace(/shadow-slate-100\/50(?! dark:shadow)/g, 'shadow-slate-100/50 dark:shadow-none');

// 3. TYPOGRAPHY TEXT INVERSIONS
// text-slate-900 -> text-slate-900 dark:text-white
content = content.replace(/text-slate-900(?! dark:text-)/g, 'text-slate-900 dark:text-white');
// text-slate-800 -> text-slate-800 dark:text-slate-200
content = content.replace(/text-slate-800(?! dark:text-)/g, 'text-slate-800 dark:text-slate-200');
// text-slate-700 -> text-slate-700 dark:text-slate-300
content = content.replace(/text-slate-700(?! dark:text-)/g, 'text-slate-700 dark:text-slate-300');
// text-slate-600 -> text-slate-600 dark:text-slate-300
content = content.replace(/text-slate-600(?! dark:text-)/g, 'text-slate-600 dark:text-slate-300');
// text-slate-500 -> text-slate-500 dark:text-slate-400
content = content.replace(/text-slate-500(?! dark:text-)/g, 'text-slate-500 dark:text-slate-400');
// text-slate-400 -> text-slate-400 dark:text-slate-500
content = content.replace(/text-slate-400(?! dark:text-)/g, 'text-slate-400 dark:text-slate-500');

// 4. TOP NAVIGATION BAR OVERHAUL
content = content.replace(
  /class="sticky top-0 z-50 w-full backdrop-blur-md bg-white\/70 dark:bg-\[#09090B\]\/80 border-b border-slate-200\/80 dark:border-slate-800"/,
  'class="sticky top-0 z-50 w-full backdrop-blur-md bg-white/70 dark:bg-[#09090B]/80 border-b border-slate-200 dark:border-[#1F2937]"'
);
// Navigation links hover states (assuming they are in nav)
content = content.replace(/hover:text-slate-900(?! dark:hover:text)/g, 'hover:text-slate-900 dark:hover:text-white');
content = content.replace(/hover:bg-slate-100(?! dark:hover:bg)/g, 'hover:bg-slate-100 dark:hover:bg-slate-800');

// Specific fix for "Good Morning," header which might be missing dark:text-white
content = content.replace(/Good Morning, <%= user\?\.firstName \|\| 'Admin' %> 👋<\/h2>/, 'Good Morning, <%= user?.firstName || \'Admin\' %> 👋</h2>');

fs.writeFileSync('views/homepage-dashboard.ejs', content, 'utf-8');
console.log('Applied theme fixes!');
