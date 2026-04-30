const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle autoplay — keeps playing related songs when queue ends"),

  async execute(interaction, bot) {
    // Toggle guild-level autoplay setting
    bot.guildAutoplay = bot.guildAutoplay || new Map();
    const current = bot.guildAutoplay.get(interaction.guild.id) || false;
    const newState = !current;
    bot.guildAutoplay.set(interaction.guild.id, newState);

    // Apply to active player if one exists
    const player = bot.manager.players.get(interaction.guild.id);
    if (player) player.setAutoPlay(newState);

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

