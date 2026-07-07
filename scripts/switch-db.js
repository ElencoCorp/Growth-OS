const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');

let schema = fs.readFileSync(schemaPath, 'utf8');

if (process.env.DB_PROVIDER === 'postgresql') {
    console.log('Switching Prisma provider to PostgreSQL...');
    schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
} else {
    console.log('Switching Prisma provider to SQLite...');
    schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
}

fs.writeFileSync(schemaPath, schema);
console.log('Done updating schema.prisma');
