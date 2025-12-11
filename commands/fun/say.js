const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something!')
    .addStringOption(option =>
        option.setName('message')
            .setDescription('The message for the bot to say')
            .setRequired(true)),

    async execute(interaction) {
        const message = interaction.options.getString('message');

        // Discord message limit is 2000 chars
        if (message.length > 2000) {
            return interaction.reply({
                content: 'Message is too long (max 2000 characters).',
                flags: MessageFlags.Ephemeral
            });
        }

        // Also check for abuse patterns
        if (message.includes('@everyone') || message.includes('@here')) {
            return interaction.reply({
                content: 'Cannot use @everyone or @here mentions.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.reply({ content: message });
    }
};