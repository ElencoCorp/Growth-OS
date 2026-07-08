const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function authRoutes(fastify, options) {
    fastify.post('/api/v1/auth/login', {
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 1 }
                }
            }
        }
    }, async (request, reply) => {
        try {
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
                secure: false, // process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 // 1 day
            });

            return reply.send({ success: true, user: { email: user.email, role: user.role } });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error during login' });
        }
    });

    fastify.post('/api/v1/auth/logout', async (request, reply) => {
        try {
            reply.clearCookie('auth_token', { path: '/' });
            return reply.send({ success: true });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error during logout' });
        }
    });
    
    fastify.get('/api/v1/auth/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
        try {
            return reply.send({ user: request.user });
        } catch (error) {
            request.log.error(error);
            return reply.code(500).send({ error: 'Internal Server Error fetching user session' });
        }
    });
}

module.exports = authRoutes;
