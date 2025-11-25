const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Displays information about a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get information about')
                .setRequired(false)),

    async execute(interaction) {
        // Get the target user (defaults to command user if not specified)
        const user = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);

        // If user not found in guild (shouldn't happen with slash commands, but just in case)
        if (!member) {
            return interaction.reply({
                content: 'Could not find that user in this server.',
                ephemeral: true // Only visible to the command user
            })
        }

        // Create an embed with user information
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`User Info: ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                {
                    name: 'Username',
                    value: user.username,
                    inline: true
                },
                {
                    name: 'Discriminator',
                    value: `#${user.discriminator}` || 'None',
                    inline: true
                },
                {
                    name: 'User ID',
                    value: user.id,
                    inline: true
                },
                {
                    name: 'Account Created',
                    value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                    inline: true
                },
                {
                    name: 'Joined Server',
                    value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'N/A',
                    inline: true
                },
                {
                    name: 'Bot?',
                    value: user.bot ? 'Yes' : 'No',
                    inline: true
                }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        // If user has roles, add them (excluding @everyone)
        if (member && member.roles.cache.size > 1) {
            const roles = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => role.toString())
                .join(', ');

            embed.addFields({
                name: 'Roles',
                value: roles || 'No roles',
                inline: false
            });
        }

        // Send the embed as a reply
        await interaction.reply({ embeds: [embed] });
    }
};