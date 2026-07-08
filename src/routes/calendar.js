const calendarController = require('../controllers/calendar.controller');

async function calendarRoutes(fastify, options) {
    fastify.get('/api/v1/locations/:id/calendar', calendarController.getCalendar);
    fastify.post('/api/v1/posts/:id/schedule', calendarController.schedulePost);
}

module.exports = calendarRoutes;
