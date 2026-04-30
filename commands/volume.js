const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set the volume (only the person who requested the current song can change it)")
    .addIntegerOption((o) =>
      o.setName("level").setDescription("Volume (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)
    ),
  async execute(interaction, bot) {
    const player = bot.manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")],
      flags: 64,
    });

    // Only the requester of the current track can change volume
    const requester = player.current?.requester;
    if (requester && requester !== interaction.user.id) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ Only <@${requester}> can change the volume right now.`)],
        flags: 64,
      });
    }

    const level = interaction.options.getInteger("level");
    player.setVolume(level);

    // Persist volume for this guild so next player uses it
    bot.guildVolumes = bot.guildVolumes || new Map();
    bot.guildVolumes.set(interaction.guild.id, level);

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(`🔊 Volume set to **${level}%**`)],
    });
  },
};

