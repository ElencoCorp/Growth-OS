const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

/**
 * Registers export routes
 * @param {import('fastify').FastifyInstance} fastify 
 */
async function exportRoutes(fastify, options) {
  
  fastify.get('/api/v1/export/backup', async (request, reply) => {
    try {
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', 'attachment; filename=all-in-one-marketing-backup.zip');

      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });

      // Send the archive stream directly to the response
      reply.send(archive);

      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          request.log.warn('Archiver warning:', err);
        } else {
          throw err;
        }
      });

      archive.on('error', function(err) {
        request.log.error('Archiver error:', err);
        throw err;
      });

      // Files to append
      const dbPath = path.join(process.cwd(), 'dev.db');
      if (fs.existsSync(dbPath)) {
        archive.file(dbPath, { name: 'dev.db' });
      }

      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        archive.file(envPath, { name: '.env' });
      }

      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
      if (fs.existsSync(schemaPath)) {
        archive.file(schemaPath, { name: 'prisma/schema.prisma' });
      }

      const tailwindPath = path.join(process.cwd(), 'tailwind.config.js');
      if (fs.existsSync(tailwindPath)) {
        archive.file(tailwindPath, { name: 'tailwind.config.js' });
      }

      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        archive.file(packagePath, { name: 'package.json' });
      }

      await archive.finalize();

    } catch (error) {
      request.log.error(error);
      if (!reply.sent) {
          return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  });

}

module.exports = exportRoutes;
