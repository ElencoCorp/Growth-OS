const nodemailer = require('nodemailer');

// We configure a JSON mock transport to output logs to terminal instead of sending real emails
const transporter = nodemailer.createTransport({
    jsonTransport: true
});

async function sendReportEmail(to, subject, htmlContent) {
    try {
        const info = await transporter.sendMail({
            from: '"Growth-OS Reporting" <reports@growth-os.example.com>',
            to: to,
            subject: subject,
            html: htmlContent
        });

        console.log('\n=======================================');
        console.log(`[Mock Email Transport] Dispatched to: ${to}`);
        console.log(`[Mock Email Transport] Subject: ${subject}`);
        console.log(`[Mock Email Transport] Message ID: ${info.messageId}`);
        console.log('--- RAW MESSAGE BEGIN ---');
        console.log(JSON.parse(info.message).html);
        console.log('--- RAW MESSAGE END ---');
        console.log('=======================================\n');

        return info;
    } catch (error) {
        console.error('[Email Service] Error dispatching email:', error);
        throw error;
    }
}

module.exports = {
    sendReportEmail
};
