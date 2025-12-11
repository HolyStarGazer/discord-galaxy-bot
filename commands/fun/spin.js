const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const crypto = require('crypto');

// Secure random integer between min (inclusive) and max (exclusive)
function secureRandom(min, max) {
    const range = max - min;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const randomBytes = crypto.randomBytes(bytesNeeded);
    const randomValue = randomBytes.readUIntBE(0, bytesNeeded);
    return min + (randomValue % range);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spin')
        .setDescription('Spin the wheel to randomly select an option!')
        .addStringOption(option =>
            option
                .setName('options')
                .setDescription('Enter options separated by commas (e.g., "Valorant, Minecraft, Fortnite")')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Parse the options from comma-separated string
        const optionsString = interaction.options.getString('options');
        const options = optionsString.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);

        // Validate input
        if (options.length < 2) {
            return interaction.reply({
                content: 'Please provide at least 2 options separated by commas!\nExample: `/spin Valorant, Minecraft, Fortnite`',
                ephemeral: MessageFlags.Ephemeral
            });
        }

        if (options.length > 15) {
            return interaction.reply({
                content: 'Too many options! Please provide 15 or fewer options.',
                ephemeral: MessageFlags.Ephemeral
            });
        }

        // Defer reply since we'll be doing animation
        await interaction.deferReply();

        // Use crypto for true randomness
        const finalIndex = secureRandom(0, options.length);
        const winner = options[finalIndex];

        // Function to create the vertical slot machine display
        function createSlotMachine(pointerPosition) {
            const maxLength = 18; // Max length for option name
            const lines = ['```'];
            
            for (let i = 0; i < options.length; i++) {
                // Truncate and pad the option name
                let optionText = options[i];
                if (optionText.length > maxLength) {
                    optionText = optionText.substring(0, maxLength - 3) + '...';
                }
                optionText = optionText.padEnd(maxLength, ' ');
                
                // Alternating solid/dotted bar
                const bar = i % 2 === 0 ? '█' : '░';
                
                // Add pointer if this is the current position
                const pointer = pointerPosition === i ? '  ◄◄' : '    ';
                
                lines.push(`${optionText} ${bar}${pointer}`);
            }
            
            lines.push('```');
            return lines.join('\n');
        }

        // Spinning animation - pointer slides down
        const totalSpins = 25; // Total animation frames

        for (let spin = 0; spin < totalSpins; spin++) {
            // Calculate pointer position (loops back to top)
            const pointerPos = spin % options.length;
            
            // Exponential slowdown - starts VERY fast, ends VERY slow
            // Early spins: ~30-50ms, late spins: ~500-800ms
            const progress = spin / totalSpins; // 0 to 1
            const delay = 30 + Math.pow(progress, 3) * 800; // Cubic easing
            
            const spinEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('Spinning...')
                .setDescription(createSlotMachine(pointerPos))
                .addFields(
                    {
                        name: 'Currently Highlighting',
                        value: `**${options[pointerPos]}**`,
                        inline: true
                    },
                    {
                        name: 'Progress',
                        value: `${Math.floor((spin / totalSpins) * 100)}%`,
                        inline: true
                    }
                )
                .setFooter({ text: `Spin ${spin + 1}/${totalSpins}` });

            await interaction.editReply({ embeds: [spinEmbed] });
            
            if (spin < totalSpins - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Final pause before revealing
        await new Promise(resolve => setTimeout(resolve, 800));

        // Create final result display with winner highlighted
        function createFinalDisplay() {
            const maxLength = 18;
            const lines = ['```'];
            
            for (let i = 0; i < options.length; i++) {
                let optionText = options[i];
                if (optionText.length > maxLength) {
                    optionText = optionText.substring(0, maxLength - 3) + '...';
                }
                optionText = optionText.padEnd(maxLength, ' ');
                
                const bar = i % 2 === 0 ? '█' : '░';
                const marker = finalIndex === i ? '  ►►' : '    ';
                
                lines.push(`${optionText} ${bar}${marker}`);
            }
            
            lines.push('```');
            return lines.join('\n');
        }

        // Final result embed
        const resultEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('THE WHEEL HAS SPOKEN!')
            .setDescription(createFinalDisplay())
            .addFields(
                {
                    name: 'Winner',
                    value: `# ${winner}`,
                    inline: false
                },
                {
                    name: 'Selection',
                    value: 'Crypto-random',
                    inline: true
                },
                {
                    name: 'Options',
                    value: `${options.length} total`,
                    inline: true
                },
                {
                    name: 'Position',
                    value: `#${finalIndex + 1}`,
                    inline: true
                }
            )
            .setFooter({ text: `Requested by @${interaction.user.tag} • Good luck!` })
            .setTimestamp();

        await interaction.editReply({ embeds: [resultEmbed] });
    }
};