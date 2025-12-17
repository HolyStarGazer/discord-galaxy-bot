const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { dbHelpers, statements } = require('../../config/database');
const {
    initializeGame,
    playerHit,
    playerStand,
    calculateHandValue,
    formatHand,
    isBlackjack,
    calculatePayout,
    getResultMessage
} = require('../../games/blackjack/blackjack-engine');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Play a game of Blackjack!')
        .addIntegerOption(option =>
            option
                .setName('bet')
                .setDescription('Amount of points to bet')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(10000)
        ),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const betAmount = interaction.options.getInteger('bet');

        // Get or create user data
        const user = dbHelpers.getOrCreateUser(userId, username);

        // Check if user has enough points
        if (user.points < betAmount) {
            return interaction.reply({
                content: `You don't have enough points! You have **${user.points}** points.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Check for active game
        const activeGame = dbHelpers.getActiveGame(userId, 'blackjack');
        if (activeGame) {
            return interaction.reply({
                content: 'You already have an active Blackjack game! Use the buttons to continue playing or wait for it to expire (24 hours).',
                flags: MessageFlags.Ephemeral
            });
        }

        // Deduct bet from user's points
        dbHelpers.subtractPoints(userId, betAmount);
        const gameState = initializeGame(betAmount);
        const sessionId = dbHelpers.createGameSession(userId, 'blackjack', gameState, betAmount);

        // Check for immediate blackjack
        const playerValue = calculateHandValue(gameState.playerHand);
        const dealerValue = calculateHandValue(gameState.dealerHand);
        const playerBlackjack = isBlackjack(gameState.playerHand);
        const dealerBlackjack = isBlackjack(gameState.dealerHand);

        if (playerBlackjack || dealerBlackjack) {
            return handleImmediateBlackjack(
                interaction,
                sessionId,
                gameState,
                userId,
                playerBlackjack,
                dealerBlackjack,
            );
        }

        // Create embed
        const embed = createGameEmbed(gameState, user, betAmount);

        // Create buttons
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`blackjack_hit_${sessionId}`)
                    .setLabel('Hit')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👆'),
                new ButtonBuilder()
                    .setCustomId(`blackjack_stand_${sessionId}`)
                    .setLabel('Stand')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('✋'),
                new ButtonBuilder()
                    .setCustomId(`blackjack_info_${sessionId}`)
                    .setLabel('Rules')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('ℹ️')
            );

        await interaction.reply({
            embeds: [embed],
            components: [buttons]
        })
    }
};

/**
 * Create game embed
 */
function createGameEmbed(gameState, user, betAmount, showDealerCards = false) {
    const playerValue = calculateHandValue(gameState.playerHand);
    const dealerValue = showDealerCards ? calculateHandValue(gameState.dealerHand) : '?';

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Blackjack')
        .setDescription(`Bet: **${betAmount}** points`)
        .addFields(
            {
                name: 'Your Hand',
                value: `${formatHand(gameState.playerHand)}\nValue: **${playerValue}**`,
                inline: true
            },
            {
                name: 'Dealer\'s Hand',
                value: `${formatHand(gameState.dealerHand, !showDealerCards)}\nValue: **${dealerValue}**`,
                inline: true
            },
            {
                name: 'Your Points',
                value: `${user.points} points`,
                inline: false
            }
        )
        .setFooter({ text: 'Hit to draw a card, Stand to end your turn' })
        .setTimestamp();

    return embed;
}

/**
 * Handle immediate blackjack (player or dealer gets 21 on deal)
 */
async function handleImmediateBlackjack(interaction, sessionId, gameState, userId, playerBlackjack, dealerBlackjack) {
    let result;

    if (playerBlackjack && dealerBlackjack) {
        result = 'push';
    } else if (playerBlackjack) {
        result = 'win';
    } else {
        result = 'loss';
    }

    gameState.result = result;
    gameState.status = 'complete';

    // Calculate payout
    const payout = calculatePayout(gameState.betAmount, result, gameState.playerHand);
    const finalPoints = await handleGameEnd(sessionId, userId, result, payout);

    // Create final embed
    const embed = new EmbedBuilder()
        .setColor(result === 'win' ? 0x00FF00 : result === 'loss' ? 0xFF0000 : 0xFFFF00)
        .setTitle('Blackjack - Game Over!')
        .setDescription(getResultMessage(result, payout, gameState.playerHand))
        .addFields(
            {
                name: 'Your Hand',
                value: `${formatHand(gameState.playerHand)}\nValue: **${calculateHandValue(gameState.playerHand)}**`,
                inline: true
            },
            {
                name: 'Dealer\'s Hand',
                value: `${formatHand(gameState.dealerHand)}\nValue: **${calculateHandValue(gameState.dealerHand)}**`,
                inline: true
            },
            {
                name: 'Final Points',
                value: `${finalPoints} points`,
                inline: false
            }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

/**
 * Handle game end - update poitns and end session
 */
async function handleGameEnd(sessionId, userId, result, payout) {
    // Award payout
    if (payout > 0) {
        dbHelpers.addPoints(userId, payout);
    }

    // Return bet on push
    if (result === 'push') {
        const game = dbHelpers.getGameSession(sessionId);
        dbHelpers.addPoints(userId, game.betAmount);
    }

    // End game session
    dbHelpers.endGameSession(sessionId, result);

    // Get final points
    const user = statements.getUser.get(userId);
    return user.points;
}