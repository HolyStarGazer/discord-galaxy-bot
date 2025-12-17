const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { statements, dbHelpers } = require('../config/database');
const { log } = require('../utils/formatters');
const {
    playerHit,
    playerStand,
    calculateHandValue,
    formatHand,
    calculatePayout,
    getResultMessage
} = require('../games/blackjack/blackjack-engine');

/**
 * Main button interaction handler for blackjack games
 */
async function handleBlackjackButton(interaction) {
    try {
        const customId = interaction.customId;

        if (!customId.startsWith('blackjack_')) {
            return false; // Not a blackjack button
        }

        const parts = customId.split('_');
        const action = parts[1]; // hit, stand, info
        const sessionId = parts.slice(2).join('_'); // rest is session ID

        // Get game session
        const game = dbHelpers.getGameSession(sessionId);

        if (!game) {
            return interaction.reply({
                content: 'This game session does not exist or has expired.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Verify it's the player's game
        if (game.user_id !== interaction.user.id) {
            return interaction.reply({
                content: 'This is not your game session!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if game is still active
        if (game.status !== 'active') {
            return interaction.reply({
                content: 'This game session has already ended.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Handle different actions
        switch (action) {
            case 'hit':
                return await handleHit(interaction, game);
            case 'stand':
                return await handleStand(interaction, game);
            case 'info':
                return await handleInfo(interaction);
            default:
                return interaction.reply({
                    content: 'Unknown action.',
                    flags: MessageFlags.Ephemeral
                });
        }
    } catch (error) {
        log('ERROR', `Blackjack button handler failed.`, 4, error);

        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({
                content: 'An error occurred while processing your request.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
}

/**
 * Handle Hit button
 */
async function handleHit(interaction, game) {
    // Player hits
    const newState = playerHit(game.game_state);
    
    // Update game state
    dbHelpers.updateGameState(game.session_id, newState);

    // Check if game ended (bust)
    if (newState.status === 'complete') {
        await handleGameComplete(interaction, game.session_id, newState, game.user_id);
    } else {
        // Update embed with new hand
        const user = statements.getUser.get(game.user_id);
        const embed = createGameEmbed(newState, user, game.bet_amount);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`blackjack_hit_${game.session_id}`)
                    .setLabel('Hit')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👆'),
                new ButtonBuilder()
                    .setCustomId(`blackjack_stand_${game.session_id}`)
                    .setLabel('Stand')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✋'),
                new ButtonBuilder()
                    .setCustomId(`blackjack_info_${game.session_id}`)
                    .setLabel('Rules')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('ℹ️')
            );

        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }
}

/**
 * Handle Stand button
 */
async function handleStand(interaction, game) {
    // Player stands - dealer plays
    const newState = playerStand(game.game_state);
    
    // Game is complete
    await handleGameComplete(interaction, game.session_id, newState, game.user_id);
}

/**
 * Handle game completion
 */
async function handleGameComplete(interaction, sessionId, gameState, userId) {
    const result = gameState.result;
    const payout = calculatePayout(gameState.betAmount, result, gameState.playerHand);
    
    // Update points
    if (payout > 0) {
        dbHelpers.addPoints(userId, payout);
    }
    
    // Return bet on push
    if (result === 'push') {
        dbHelpers.addPoints(userId, gameState.betAmount);
    }

    // End game session
    dbHelpers.endGameSession(sessionId, result);

    // Get final points
    const user = statements.getUser.get(userId);

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
                value: `${user.points} points`,
                inline: false
            }
        )
        .setTimestamp();

    await interaction.update({
        embeds: [embed],
        components: [] // Remove buttons
    });
}

/**
 * Handle Info button
 */
async function handleInfo(interaction) {
    const rulesEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Blackjack Rules')
        .setDescription('Learn how to play Blackjack!')
        .addFields(
            {
                name: 'Objective',
                value: 'Get as close to 21 as possible without going over. Beat the dealer\'s hand!',
                inline: false
            },
            {
                name: 'Card Values',
                value: '• Number cards (2-10): Face value\n• Face cards (J, Q, K): 10 points\n• Ace: 1 or 11 points (whichever is better)',
                inline: false
            },
            {
                name: 'How to Play',
                value: '1. Place your bet\n2. You and the dealer each get 2 cards\n3. **Hit** to draw another card\n4. **Stand** to keep your current hand\n5. Dealer plays after you stand',
                inline: false
            },
            {
                name: 'Winning',
                value: '• **Blackjack** (21 with 2 cards): 3:2 payout\n• **Win**: 1:1 payout\n• **Push** (tie): Bet returned\n• **Bust** (over 21): Lose bet',
                inline: false
            },
            {
                name: 'Dealer Rules',
                value: 'Dealer must hit on 16 or less, and stand on 17 or more.',
                inline: false
            }
        )
        .setFooter({ text: 'Good luck! 🍀' });

    await interaction.reply({
        embeds: [rulesEmbed],
        ephemeral: true
    });
}

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

module.exports = {
    handleBlackjackButton
};