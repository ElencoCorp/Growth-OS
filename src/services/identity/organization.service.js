const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createOrganization(name, ownerId) {
    try {
        const org = await prisma.organization.create({
            data: {
                name,
                ownerId,
                members: {
                    create: {
                        userId: ownerId,
                        role: 'ADMIN'
                    }
                }
            },
            include: {
                members: true
            }
        });
        return org;
    } catch (error) {
        console.error('[Organization Service] Error creating org:', error);
        throw error;
    }
}

async function getOrganizationsForUser(userId) {
    try {
        const orgs = await prisma.organization.findMany({
            where: {
                members: {
                    some: {
                        userId: userId
                    }
                }
            }
        });
        return orgs;
    } catch (error) {
        console.error('[Organization Service] Error fetching orgs for user:', error);
        throw error;
    }
}

async function addMemberToOrganization(orgId, userId, role = 'MEMBER') {
    try {
        const member = await prisma.organizationMember.create({
            data: {
                organizationId: orgId,
                userId: userId,
                role: role
            }
        });
        return member;
    } catch (error) {
        console.error('[Organization Service] Error adding member:', error);
        throw error;
    }
}

module.exports = {
    createOrganization,
    getOrganizationsForUser,
    addMemberToOrganization
};
