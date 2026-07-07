require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const aiService = require('./services/ai.service');

const basePrisma = new PrismaClient();

const prisma = basePrisma.$extends({
  query: {
    review: {
      async create({ args, query }) {
        const result = await query(args);
        
        // Asynchronously process the AI reply without blocking the create operation
        if (!result.reply && result.text) {
          aiService.generateReviewReply(result.text).then(async (draft) => {
            await basePrisma.review.update({
              where: { id: result.id },
              data: { reply: draft }
            });

          }).catch(err => {
            console.error(`[Auto-Reply Hook] Failed to generate reply for review ID ${result.id}:`, err.message);
          });
        }
        
        return result;
      }
    }
  }
});

module.exports = prisma;
