const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("recent").setDescription("Show the last 10 played songs"),

  async execute(interaction, bot) {
    if (!bot.recentSongs.length) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ No songs have been played yet.")],
        ephemeral: true,
      });
    }

    const list = bot.recentSongs
      .map((s, i) => `**${i + 1}.** [${s.title}](${s.url})`)
      .join("\n");

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(config.embedColor)
          .setTitle("🕘 Recently Played")
          .setDescription(list),
      ],
    });
  },
};
