const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const {
    isAvailable,
    checkRateLimit,
    recordRequest,
    chat,
    estimateTokens,
    getPersonaChoices,
    getModelChoices,
    aiConfig
} = require('../../services/ai/anthropic-client');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Chat with an AI assistant powered by Anthropic')
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Your message to the AI')
                .setRequired(true)
                .setMaxLength(200)
        )
        .addStringOption(option =>
            option
                .setName('persona')
                .setDescription('AI personality preset')
                .addChoices(...getPersonaChoices())
        )
        .addStringOption(option =>
            option
                .setName('model')
                .setDescription('AI model to use')
                .addChoices(...getModelChoices())
        )
        .addNumberOption(option =>
            option
                .setName('temperature')
                .setDescription('Creativity level (0.0 = focused, 1.0 = creative)')
                .setMinValue(0.0)
                .setMaxValue(1.0)
        ),

    async execute(interaction) {
        // Check if AI service is available
        if (!isAvailable()) {
            return interaction.reply({
                content: 'AI chat is not available. The bot administrator may need to configure the API key.',
                flags: MessageFlags.Ephemeral
            });
        }

        const userId = interaction.user.id;
        const channelId = interaction.channelId;
        const message = interaction.options.getString('message');
        const persona = interaction.options.getString('persona');
        const model = interaction.options.getString('model');
        const temperature = interaction.options.getNumber('temperature');

        // Check rate limit
        const rateCheck = checkRateLimit(userId);
        if (!rateCheck.allowed) {
            let errorMessage;
            switch (rateCheck.reason) {
                case 'cooldown':
                    errorMessage = `Please wait ${rateCheck.waitTime} second(s) before sending another message.`;
                    break;
                case 'hourly_limit':
                    errorMessage = `You've reached the hourly limit (${aiConfig.rateLimit.maxRequestsPerHour} requests). Please try again later.`;
                    break;
                case 'daily_limit':
                    errorMessage = `You've reached the daily limit (${aiConfig.rateLimit.maxRequestsPerDay} requests). Please try again tomorrow.`;
                    break;
                default:
                    errorMessage = 'Rate limit exceeded. Please try again later.';
            }
            return interaction.reply({
                content: errorMessage,
                flags: MessageFlags.Ephemeral
            });
        }

        // Estimate input tokens
        const estimatedTokens = estimateTokens(message);
        if (estimatedTokens > aiConfig.tokens.maxInput) {
            return interaction.reply({
                content: `Your message is too long (estimated ${estimatedTokens} tokens). Please shorten it.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Defer reply since AI response may take a moment
        await interaction.deferReply();

        try {
            // Record the request for rate limiting
            recordRequest(userId);

            // Send to AI
            const response = await chat({
                userId,
                channelId,
                message,
                persona,
                model,
                temperature
            });

            // Format response
            const reply = response.reply;

            // Check if reply is too long for Discord
            if (reply.length > 2000) {
                // Split into multiple messages or use embed
                const embed = new EmbedBuilder()
                    .setColor(0x7C3AED)
                    .setTitle('AI Response')
                    .setDescription(reply.slice(0, 4096))
                    .setFooter({
                        text: `${response.persona} | ${response.usage.inputTokens}/${response.usage.outputTokens} tokens`
                    });
                
                await interaction.editReply({ embeds: [embed] });
            } else {
                // Simple text reply for shorter responses
                await interaction.editReply({
                    content: reply
                });
            }
        } catch (error) {
            console.error('Chat command error:', error);

            let errorMessage = 'Sorry, I encountered an error while processing your request.';

            if (error.message.includes('rate limit')) {
                errorMessage = 'The AI service is currently busy. Please try again in a moment.';
            } else if (error.message.includes('invalid_api_key')) {
                errorMessage = 'AI service configuration error. Please contact the bot administrator.';
            }

            await interaction.editReply({
                content: errorMessage
            });
        }
    }
};