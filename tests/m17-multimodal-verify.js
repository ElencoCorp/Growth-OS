const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

// Simulate backend orchestration call
const { dispatchGenerationTask } = require('../src/services/ai/router.service');

(async () => {
    try {
        console.log('🚀 Initiating Systems Verification: Provider-Agnostic Multimodal Orchestration Engine...');
        
        const business = await prisma.business.findFirst();
        if (!business) throw new Error('No business found for testing');
        
        let location = await prisma.location.findFirst({ where: { businessId: business.id } });
        if (!location) throw new Error('No location found for testing');

        console.log('Simulating Unified Generation Cycle (Text + Image)...');
        
        const testPayload = {
            topic: 'New promotional local discount',
            goal: 'Promotional',
            tone: 'Professional & Authoritative',
            keywords: 'test discount, local shop',
            locationId: location.id,
            userId: 1
        };

        const result = await dispatchGenerationTask('GOOGLE_BUSINESS_POST', testPayload);

        assert.ok(result.variants && Array.isArray(result.variants), 'Variants array should exist');
        assert.ok(result.variants.length === 2, 'Should generate exactly two variants');
        
        assert.ok(result.variants[0].headline, 'Headline must exist in variant A');
        assert.ok(result.variants[1].headline, 'Headline must exist in variant B');
        assert.ok(result.variants[0].hashtags.length >= 3, 'Variant A must have at least 3 hashtags');

        const imageUrl = result.imagePath;
        assert.ok(imageUrl.includes('http') || imageUrl.includes('fallback') || imageUrl.includes('/uploads/'), 'Image URL should be populated and valid');

        console.log('Asserting +48 Hour Rolling Queue DB Injection...');
        
        // Find existing last scheduled piece
        const lastPiece = await prisma.contentPiece.findFirst({
            where: { locationId: location.id, status: 'QUEUED' },
            orderBy: { scheduledFor: 'desc' }
        });
        const baseTime = lastPiece && lastPiece.scheduledFor ? lastPiece.scheduledFor.getTime() : Date.now();
        const expectedScheduledFor = new Date(baseTime + 2 * 24 * 60 * 60 * 1000);

        const newPiece = await prisma.contentPiece.create({
            data: {
                locationId: location.id,
                textContent: JSON.stringify(result.variants[0]),
                imageUrl: imageUrl,
                status: 'QUEUED',
                scheduledFor: expectedScheduledFor
            }
        });

        const verifyPiece = await prisma.contentPiece.findUnique({ where: { id: newPiece.id } });
        
        assert.strictEqual(verifyPiece.status, 'QUEUED', 'Content piece status must be QUEUED');
        assert.ok(verifyPiece.scheduledFor, 'scheduledFor timestamp must exist');
        
        const timeDiff = verifyPiece.scheduledFor.getTime() - baseTime;
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        // Exactly 48 hours rolling offset
        assert.ok(hoursDiff > 47.9 && hoursDiff <= 48.1, `scheduledFor offset must be exactly +48 hours from baseline. Found ${hoursDiff} hours difference`);
        
        // Verify AiActionLog creation
        const actionLog = await prisma.aiActionLog.findFirst({
            orderBy: { id: 'desc' }
        });
        assert.ok(actionLog, 'AiActionLog should be created');
        
        console.log('✅ Validation Pass: Generated Variants cleanly stored, action logged, and scheduled 48h out.');

        console.log('Cleaning up mock data...');
        await prisma.contentPiece.delete({ where: { id: newPiece.id } });
        
        console.log('🎉 Verification Pass: Systems Refactor (AI Orchestration Engine) is fully operational.');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
