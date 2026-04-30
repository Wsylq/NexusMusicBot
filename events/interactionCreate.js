const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, bot) {
    if (!interaction.isChatInputCommand()) return;

    const command = bot.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, bot);
    } catch (err) {
      console.error(`[Command Error] ${interaction.commandName}:`, err);
      const embed = new EmbedBuilder().setColor("Red").setDescription("❌ An error occurred while running this command.");
      if (interaction.deferred || interaction.replied) {
        interaction.editReply({ embeds: [embed] }).catch(() => {});
      } else {
        interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
      }
    }
  },
};
