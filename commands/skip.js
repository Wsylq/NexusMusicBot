const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),
  async execute(interaction, bot) {
    const player = bot.manager.players.get(interaction.guild.id);
    if (!player?.playing) return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")], ephemeral: true });
    const title = player.current?.title;
    player.skip();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(`⏭️ Skipped **${title}**`)] });
  },
};
