// =================================
// BLACKJACK GAME ENGINE
// =================================

/**
 * Card suits and values
 */
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * Create a standard 52-card deck
 */
function createDeck() {
    const deck = [];

    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value });
        }
    }

    return deck;
}

/**
 * Shuffle deck using Fisher-Yates algorithm
 */
function shuffleDeck(deck) {
    const shuffled = [...deck];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

/**
 * Calculate hand value (handle Aces as 1 or 11
 */
function calculateHandValue(hand) {
    let value = 0;
    let aces = 0;

    for (const card of hand) {
        if (card.value === 'A') {
            aces++;
            value += 11;
        } else if (['K', 'Q', 'J'].includes(card.value)) {
            value += 10;
        } else {
            value += parseInt(card.value);
        }
    }

    // Convert Aces from 11 to 1 if needed
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }

    return value;
}

/**
 * Format a card for display
 */
function formatCard(card) {
    return `${card.value}${card.suit}`;
}

/**
 * Format a hand for display
 */
function formatHand(hand, hideFirst = false) {
    if (hideFirst) {
        return `🂠  ${hand.slice(1).map(formatCard).join(' ')}`; // Show hidden card as well
    }

    return hand.map(formatCard).join(' ');
}

/**
 * Check if hand is blackjack (21 with 2 cards)
 */
function isBlackjack(hand) {
    return hand.length === 2 && calculateHandValue(hand) === 21;
}

/**
 * Check if hand is bust
 */
function isBust(hand) {
    return calculateHandValue(hand) > 21;
}

/**
 * Initialize a new blackjack game
 */
function initializeGame(betAmount) {
    const deck = shuffleDeck(createDeck());

    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    return {
        deck,
        playerHand,
        dealerHand,
        betAmount,
        status: 'active',
        playerTurn: true,
        result: null
    }
}

/**
 * Player hits (draws a card)
 */
function playerHit(gameState) {
    const newState = { ...gameState };
    newState.playerHand = [...newState.playerHand, newState.deck.pop()];

    // Check for bust
    if (isBust(newState.playerHand)) {
        newState.status = 'complete';
        newState.playerTurn = false;
        newState.result = 'bust';
    }

    return newState;
}

/**
 * Player stands (ends turn)
 */
function playerStand(gameState) {
    const newState = { ...gameState };
    newState.playerTurn = false;

    // Dealer plays
    return dealerPlay(newState);
}

/**
 * Dealer plays according to blackjack rules
 * Dealer must hit on 16 or less, stand on 17 or more
 */
function dealerPlay(gameState) {
    const newState = { ...gameState };

    while (calculateHandValue(newState.dealerHand) < 17) {
        newState.dealerHand = [...newState.dealerHand, newState.deck.pop()];
    }

    // Determine winner
    const playerValue = calculateHandValue(newState.playerHand);
    const dealerValue = calculateHandValue(newState.dealerHand);

    if (isBust(newState.dealerHand)) {
        newState.result = 'win';
    } else if (dealerValue > playerValue) {
        newState.result = 'loss';
    } else if (playerValue > dealerValue) {
        newState.result = 'win';
    } else {
        newState.result = 'push';
    }

    newState.status = 'complete';
    return newState;
}

/**
 * Calculate payout based on result
 */
function calculatePayout(betAmount, result, playerHand) {
    if (result === 'bust' || result === 'loss') {
        return; // Lost bet
    } else if (result === 'push') {
        return betAmount; // Bet returned
    } else if (isBlackjack(playerHand)) {
        return Math.floor(betAmount * 2 * 1.5); // Blackjack pays 3:2 (double because original bet is returned)
    } else {
        return betAmount * 2; // Normal win pays 1:1 (double the bet because original bet is returned)
    }
}

/**
 * Get result message
 */
function getResultMessage(result, payout, playerHand) {
    if (result === 'bust') {
        return `Bust! You went over 21. Lost ${payout} points.`
    } else if (result === 'loss') {
        return `Dealer wins! Lost ${payout} points.`
    } else if (result === 'push') {
        return `Push! Your bet has been returned.`
    } else if (isBlackjack(playerHand)) {
        return `Blackjack! Won ${payout} points! (3:2 payout)`
    } else {
        return `You win! Won ${payout} points!`
    }
}

module.exports = {
    createDeck,
    shuffleDeck,
    calculateHandValue,
    formatCard,
    formatHand,
    isBlackjack,
    isBust,
    initializeGame,
    playerHit,
    playerStand,
    calculatePayout,
    getResultMessage
};