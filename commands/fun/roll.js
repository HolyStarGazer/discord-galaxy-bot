const { SlashCommandBuilder } = require('discord.js');

const DEFAULT_DICE = 1;
const DEFAULT_SIDES = 6;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Rolls a dice in NdN format (e.g., 2d6 rolls two six-sided dice).')
        .addIntegerOption(option =>
            option.setName('dice')
                .setDescription('Number of dice to roll')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('sides')
                .setDescription('Number of sides on each die')
                .setMinValue(2)
                .setMaxValue(1000)
                .setRequired(false)),

    async execute(interaction) {
        // Defer reply to allow more time for processing (buys 15 minutes)
        await interaction.deferReply();

        const numDice = interaction.options.getInteger('dice') || DEFAULT_DICE;
        const numSides = interaction.options.getInteger('sides') || DEFAULT_SIDES;

        // Roll the dice
        const rolls = [];
        let total = 0;

        for (let i = 0; i < numDice; i++) {
            const roll = Math.floor(Math.random() * numSides) + 1;
            rolls.push(roll);
            total += roll;
        }

        // Format the response
        let response = `🎲 Rolling ${numDice}d${numSides}...\n`;
        response += `**Result:** [${rolls.join(', ')}]\n`;
        
        if (numDice > 1) {
            response += `**Total:** ${total}`;
        }

        await interaction.editReply(response);
    }
};