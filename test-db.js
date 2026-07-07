const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Locations:', JSON.stringify(await prisma.location.findMany({ include: { reviews: true } }), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
