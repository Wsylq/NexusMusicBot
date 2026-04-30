const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle autoplay — keeps playing related songs when queue ends"),

  async execute(interaction, bot) {
    const player = bot.manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")],
      ephemeral: true,
    });

    const newState = !player.autoPlay;
    player.setAutoPlay(newState);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(config.embedColor)
          .setDescription(newState
            ? "🔀 Autoplay **enabled** — I'll keep playing related songs when the queue ends."
            : "⏹️ Autoplay **disabled**."
          ),
      ],
    });
  },
};
