const prisma = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  const count = await prisma.user.count();
  if (count === 0) {
    console.log('Database empty. Seeding core credentials...');
    
    const defaultPassword = await bcrypt.hash('password123', 10);
    
    await prisma.user.createMany({
        data: [
            { email: 'admin@growthos.com', passwordHash: defaultPassword, role: 'Administrator' },
            { email: 'client@growthos.com', passwordHash: defaultPassword, role: 'Client' }
        ]
    });
    
    console.log(`Database seeded successfully. Auth credentials created: admin@growthos.com / password123`);
  } else {
    // Ensure auth users exist even if DB was already seeded
    const adminExists = await prisma.user.findFirst({ where: { role: 'Administrator' }});
    if (!adminExists) {
        const defaultPassword = await bcrypt.hash('password123', 10);
        await prisma.user.createMany({
            data: [
                { email: 'admin@growthos.com', passwordHash: defaultPassword, role: 'Administrator' },
                { email: 'client@growthos.com', passwordHash: defaultPassword, role: 'Client' }
            ]
        });
        console.log(`Auth credentials appended successfully.`);
    }
    console.log('Database already seeded. Skipping.');
  }
}

module.exports = seed;
