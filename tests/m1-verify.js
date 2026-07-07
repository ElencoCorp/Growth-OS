require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- Starting Milestone 1 Validation ---');
  try {
    // 1. Database Creation
    console.log('[Test 1] Creating Multi-Tenant Data...');
    const org = await prisma.organization.create({
      data: {
        name: 'Elenco Corp',
        businesses: {
          create: {
            name: 'Local Plumbers',
            locations: {
              create: {
                name: 'Downtown Office',
                address: '123 Main St',
                reviews: {
                  create: [
                    { authorName: 'John D.', rating: 5, text: 'Great service!' }
                  ]
                }
              }
            }
          }
        }
      }
    });
    console.log('  -> Success! Created Organization ID:', org.id);

    // 2. Fetch Data
    console.log('[Test 2] Querying Nested Data...');
    const fetchedOrg = await prisma.organization.findUnique({
      where: { id: org.id },
      include: {
        businesses: {
          include: {
            locations: {
              include: {
                reviews: true
              }
            }
          }
        }
      }
    });
    
    if (fetchedOrg.businesses[0].locations[0].reviews.length === 1) {
      console.log('  -> Success! Data fetched correctly with relationships.');
    } else {
      throw new Error('Data mismatch.');
    }

    console.log('--- Milestone 1 Validation Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('Milestone 1 Validation Failed:', error);
    process.exit(1);
  }
}

runTests();
