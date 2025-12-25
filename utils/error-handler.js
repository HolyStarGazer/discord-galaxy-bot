const { log, logWithTimestamp } = require('./formatters');
const { MessageFlags } = require('discord.js');

/**
 * Wrap async command execution with error handling
 */
function wrapCommand(commandFn) {
    return async (interaction) => {
        try {
            await commandFn(interaction);
        } catch (error) {
            logWithTimestamp('ERROR', `Command failed: ${interaction.commandName}`, 4, error);

            const errorMessage = {
                content: 'An error occurred while executing this command.',
                flags: MessageFlags.Ephemeral
            };

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (error) {
                // Interaction expired or already handled
                log('WARN', 'Could not send error message to user', 4);
            }
        }
    };
}

/**
 * Global unhandled rejection handler with context
 */
function setupGlobalErrorHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
        logWithTimestamp('ERROR', 'Unhandled Promise Rejection', 4, reason);
    });

    process.on('uncaughtException', (error) => {
        logWithTimestamp('ERROR', 'Uncaught Exception', 4, error);
    });
}

module.exports = {
    wrapCommand,
    setupGlobalErrorHandlers
}