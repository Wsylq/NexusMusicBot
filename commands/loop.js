const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Set loop mode")
    .addStringOption((o) =>
      o.setName("mode")
        .setDescription("Loop mode")
        .setRequired(true)
        .addChoices(
          { name: "Off", value: "none" },
          { name: "Track", value: "track" },
          { name: "Queue", value: "queue" }
        )
    ),

  async execute(interaction, bot) {
    const queue = bot.queues.get(interaction.guild.id);
    if (!queue) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")], ephemeral: true });
    }

    const mode = interaction.options.getString("mode");
    queue.loop = mode;

    const labels = { none: "🔁 Loop off", track: "🔂 Looping current track", queue: "🔁 Looping queue" };
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(labels[mode])],
    });
  },
};
