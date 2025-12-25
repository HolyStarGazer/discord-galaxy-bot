const { log } = require('./formatters')

const REQUIRED_ENV = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
];

function validateEnv() {
    const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        log('ERROR', 'Missing required environment variables:');
        missing.forEach((key) => console.log(`    - ${key}`));
        log('INFO', 'Please check your .env file');
        process.exit(1);
    }

    // Validate token format (basic check)
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token.includes('.')) {
        log('ERROR', 'DISCORD_BOT_TOKEN appears to be invalid.');
        process.exit(1);
    }

    // Validate Discord IDs are numeric
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!/^\d{17,19}$/.test(clientId)) {
        log('ERROR', 'DISCORD_CLIENT_ID must be a valid Discord ID (17-19 digits).');
        process.exit(1);
    }

    if (guildId && !/^\d{17,19}$/.test(guildId)) {
        log('ERROR', 'DISCORD_GUILD_ID must be a valid Discord ID (17-19 digits).');
        process.exit(1);
    }
}

module.exports = { validateEnv };