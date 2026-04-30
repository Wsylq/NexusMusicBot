const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current queue")
    .addIntegerOption((o) => o.setName("page").setDescription("Page number").setMinValue(1)),
  async execute(interaction, bot) {
    const player = bot.manager.players.get(interaction.guild.id);
    if (!player || (!player.playing && player.queue.isEmpty)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ The queue is empty.")], flags: 64 });
    }

    const current = player.current;
    const upcoming = player.queue.all || [];
    const all = current ? [current, ...upcoming] : [...upcoming];

    const perPage = 10;
    const page = (interaction.options.getInteger("page") || 1) - 1;
    const totalPages = Math.ceil(all.length / perPage);

    const songs = all
      .slice(page * perPage, page * perPage + perPage)
      .map((t, i) => {
        const pos = page * perPage + i;
        const prefix = pos === 0 ? "▶️" : `**${pos}.**`;
        return `${prefix} [${t.title}](${t.uri})`;
      })
      .join("\n");

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(config.embedColor)
          .setTitle(`Queue — ${all.length} song${all.length !== 1 ? "s" : ""}`)
          .setDescription(songs)
          .setFooter({ text: `Page ${page + 1}/${totalPages}` }),
      ],
    });
  },
};

