const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function authRoutes(fastify, options) {
    fastify.post('/api/v1/auth/login', async (request, reply) => {
        const { email, password } = request.body;
        
        if (!email || !password) {
            return reply.code(400).send({ error: 'Email and password required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return reply.code(401).send({ error: 'Invalid credentials' });
        }

        const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
        
        reply.setCookie('auth_token', token, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 // 1 day
        });

        return reply.send({ success: true, user: { email: user.email, role: user.role } });
    });

    fastify.post('/api/v1/auth/logout', async (request, reply) => {
        reply.clearCookie('auth_token', { path: '/' });
        return reply.send({ success: true });
    });
    
    fastify.get('/api/v1/auth/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
        return reply.send({ user: request.user });
    });
}

module.exports = authRoutes;
