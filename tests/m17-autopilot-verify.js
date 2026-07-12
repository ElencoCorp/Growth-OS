const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

// We simulate the backend orchestration call to avoid Playwright UI overhead since it's a backend verification.
const contentStudioService = require('../src/services/content-studio.service');

(async () => {
    try {
        console.log('🚀 Initiating Milestone 17.5 Autopilot Verification...');
        
        const business = await prisma.business.findFirst();
        if (!business) throw new Error('No business found for testing');
        
        let location = await prisma.location.findFirst({ where: { businessId: business.id } });
        if (!location) throw new Error('No location found for testing');

        console.log('Setting location to Autopilot Mode...');
        // Force autopilot on
        await prisma.location.update({
            where: { id: location.id },
            data: { autoPilotEnabled: true }
        });

        console.log('Simulating AI Generation payload in Autopilot...');
        const testContext = "Test auto pilot promotion";
        
        // We will call the underlying service to see if it sets +48 hours and QUEUED status
        // Since contentStudioService requires process.env.TEXT_API_KEY, we bypass actual LLM failure warnings
        // and just let it fall back or succeed.
        
        // We can't easily call createDraftPost directly because it's not exported.
        // Let's check what's exported.
        // If createDraftPost is not exported, we use generateLocalPost or similar.
        const exported = Object.keys(contentStudioService);
        console.log('Available studio functions:', exported);
        
        let createdPieceId;
        if (contentStudioService.generateLocalPost) {
            const piece = await contentStudioService.generateLocalPost(location.id, testContext);
            createdPieceId = piece.id;
        } else {
             // Mock creating a draft manually based on the logic to verify the +48h math if not exported
             throw new Error('Could not find generateLocalPost to trigger createDraftPost');
        }

        console.log('Asserting Autopilot Queued State and +48 Hour Offset...');
        const verifyPiece = await prisma.contentPiece.findUnique({ where: { id: createdPieceId } });
        
        assert.strictEqual(verifyPiece.status, 'QUEUED', 'Content piece should bypass DRAFT_PENDING_REVIEW and set to QUEUED directly');
        
        assert.ok(verifyPiece.scheduledFor, 'scheduledFor timestamp must exist');
        
        const timeDiff = verifyPiece.scheduledFor.getTime() - Date.now();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        // Assert it is roughly 48 hours (allow a few seconds of execution drift)
        assert.ok(hoursDiff > 47.9 && hoursDiff <= 48.1, `scheduledFor offset must be exactly +48 hours. Found ${hoursDiff} hours difference`);

        console.log('✅ Validation Pass: Autopilot +48 hour scheduling correctly enforced.');
        
        console.log('Cleaning up mock data...');
        await prisma.contentPiece.delete({ where: { id: createdPieceId } });
        
        console.log('🎉 Verification Pass: Milestone 17.5 (Autopilot Queue Engine) is fully operational.');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
