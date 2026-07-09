const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fetch = globalThis.fetch;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function mapHeadersWithGroq(rawHeaders) {
    const apiKey = process.env.TEXT_API_KEY;
    if (!apiKey) {
        return { name: rawHeaders[0], address: rawHeaders[1], phone: rawHeaders[2] };
    }

    const systemPrompt = `You are a data transformation AI specializing in mapping messy CSV headers to a strict database schema.
Map the provided messy headers exactly to these 3 keys: 'name', 'address', 'phone'.
Output ONLY a valid JSON object where keys are the explicit database parameters and values are the corresponding messy header strings.
No explanation. No intro. No outro.`;

    const userPrompt = `Messy Headers: ${JSON.stringify(rawHeaders)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Groq HTTP error: ${response.status}`);
        }

        const data = await response.json();
        const jsonStr = data.choices[0].message.content.trim();
        const match = jsonStr.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('[Bulk Importer] Groq AI header translation failed. Falling back to index mapping.', error.message);
        return { name: rawHeaders[0], address: rawHeaders[1], phone: rawHeaders[2] };
    }
}

async function getOrganizationCapacity(orgId) {
    const org = await prisma.organization.findUnique({
        where: { id: parseInt(orgId, 10) },
        include: { locations: true }
    });

    if (!org) throw new Error('Organization not found');

    if (!org.subscriptionActive) {
        throw new Error('Subscription is inactive. Cannot import locations.');
    }

    const currentCount = org.locations.length;
    // Basic limit logic for 402 manual software licensing boundaries
    const maxCapacity = org.planType === 'PRO' ? 50 : 10;
    const availableSlots = maxCapacity - currentCount;

    return {
        orgId: org.id,
        planType: org.planType,
        maxCapacity,
        currentCount,
        availableSlots
    };
}

async function executeBulkImport(orgId, businessId, locationsArray, mappedKeys = null) {
    const capacity = await getOrganizationCapacity(orgId);

    if (locationsArray.length > capacity.availableSlots) {
        throw new Error(`Operational capacity exception. Import size (${locationsArray.length}) exceeds available slots (${capacity.availableSlots}). Upgrade plan to allocate more capacity.`);
    }

    const onboardedBatchId = `batch_${Date.now()}`;
    const results = {
        batchId: onboardedBatchId,
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        skipped: []
    };

    // Determine the mapping for fields
    let activeMap = mappedKeys;
    if (!activeMap && locationsArray.length > 0) {
        const sampleRecord = locationsArray[0];
        const headers = Object.keys(sampleRecord);
        const hasStandardFields = headers.includes('name') && headers.includes('address') && headers.includes('phone');
        
        if (!hasStandardFields) {
            activeMap = await mapHeadersWithGroq(headers);
        } else {
            activeMap = { name: 'name', address: 'address', phone: 'phone' };
        }
    }

    // Chunking algorithm for SQLite protection (25 records per micro-batch)
    const chunkSize = 25;
    for (let i = 0; i < locationsArray.length; i += chunkSize) {
        const chunk = locationsArray.slice(i, i + chunkSize);

        for (const record of chunk) {
            try {
                const locName = record[activeMap?.name] || record.name;
                const locAddress = record[activeMap?.address] || record.address || 'Address missing';
                const locPhone = record[activeMap?.phone] || record.phone || '';

                if (!locName) {
                    throw new Error('Location Name is structurally required.');
                }

                await prisma.location.create({
                    data: {
                        name: locName,
                        address: locAddress,
                        phone: locPhone,
                        businessId: parseInt(businessId, 10),
                        organizationId: parseInt(orgId, 10),
                        onboardedBatchId,
                        googleVerificationStatus: 'UNVERIFIED',
                        googlePlaceId: `mock_place_${Date.now()}_${Math.floor(Math.random() * 1000)}`
                    }
                });

                results.successful++;
            } catch (err) {
                console.warn(`[Bulk Importer] Skipped record:`, err.message);
                results.failed++;
                results.skipped.push({ record, reason: err.message });
            }
            results.totalProcessed++;
        }

        // Delay to prevent SQLite write-lock blocks
        await sleep(100);
    }

    return results;
}

module.exports = {
    getOrganizationCapacity,
    executeBulkImport,
    mapHeadersWithGroq
};
