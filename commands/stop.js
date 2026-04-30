const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Stop music and clear the queue"),
  async execute(interaction, bot) {
    const player = bot.manager.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")], ephemeral: true });
    player.destroy();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription("⏹️ Stopped and cleared the queue.")] });
  },
};
