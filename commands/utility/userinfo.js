const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { dbHelpers } = require('../../config/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Display information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get information about')
                .setRequired(false)),
    
    async execute(interaction) {
        // Get the target user (defaults to command user if not specified)
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild.members.cache.get(targetUser.id);
        
        // If user not found in guild
        if (!member) {
            return interaction.reply({ 
                content: 'Could not find that user in this server.', 
                ephemeral: true
            });
        }
        
        // Get user's XP data if they exist in the database
        let userData = null;
        let userRank = null;
        try {
            userData = dbHelpers.getOrCreateUser(targetUser.id, targetUser.username);
            userRank = dbHelpers.getUserRank(targetUser.id);
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
        
        // Format dates
        const accountCreated = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D>`;   // Absolute date
        const accountAge = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`;       // Relative time
        const joinedServer = `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`;          // Absolute date
        const joinedAge = `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`;             // Relative time
        
        // Build embed
        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor || '#5865F2')
            .setTitle(`${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();
        
        // User Information Section
        embed.addFields({
            name: '__User Information__',
            value: [
                `**Username:** ${targetUser.username}`,
                `**Display Name:** ${member.displayName}`,
                `**User ID:** \`${targetUser.id}\``,
                `**Bot:** ${targetUser.bot ? 'Yes' : 'No'}`,
                `**Mention:** <@${targetUser.id}>`
            ].join('\n'),
            inline: true
        });
        
        // Server Information Section
        const roleCount = member.roles.cache.size - 1; // Exclude @everyone
        
        embed.addFields({
            name: '__Server Information__',
            value: [
                `**Joined Server:** ${joinedServer} (${joinedAge})`,
                `**Account Created:** ${accountCreated} (${accountAge})`,
                `**Roles:** ${roleCount}`,
                `**Nickname:** ${member.nickname || 'None'}`
            ].join('\n'),
            inline: true
        });
        
        // XP & Activity Section (if user has data)
        if (userData && userData.xp > 0) {
            const currentLevelXP = userData.level * userData.level * 100;
            const nextLevelXP = (userData.level + 1) * (userData.level + 1) * 100;
            const xpProgress = Math.max(0, userData.xp - currentLevelXP);
            const xpNeeded = nextLevelXP - currentLevelXP;
            const progressPercent = Math.floor((xpProgress / xpNeeded) * 100);


            // Progress bar
            const barLength = 10;
            const filledBars = Math.min(barLength, Math.max(0, Math.floor((xpProgress / xpNeeded) * barLength)));
            const progressBar = '█'.repeat(filledBars) + '░'.repeat(barLength - filledBars); 
            
            embed.addFields({
                name: '__Level & Activity__',
                value: [
                    `**Level:** ${userData.level} • **Rank:** #${userRank || 'N/A'}`,
                    `**Total XP:** ${userData.xp.toLocaleString()} • **Messages:** ${userData.total_messages.toLocaleString()}`,
                    `**Progress:** \`${progressBar}\` ${progressPercent}%`,
                    `**Next Level:** ${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`
                ].join('\n'),
                inline: false
            });
        }
        
        // Roles Section (if has roles)
        if (roleCount > 0) {
            const roles = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString())
                .slice(0, 15); // Limit to 15 roles to avoid field overflow
            
            const roleText = roles.join(' ');
            embed.addFields({
                name: `__Roles [${roleCount}]__`,
                value: roleText.length > 1024 ? roleText.substring(0, 1020) + '...' : roleText,
                inline: false
            });
        }
        
        // Footer
        embed.setFooter({ 
            text: `Requested by ${interaction.user.username}`, 
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
        });
        
        // Send the embed
        await interaction.reply({ embeds: [embed] });
    }
};