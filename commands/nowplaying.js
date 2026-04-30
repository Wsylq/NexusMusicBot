const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Show the currently playing song"),
  async execute(interaction, bot) {
    const player = bot.manager.players.get(interaction.guild.id);
    const track = player?.current;
    if (!track) return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")], ephemeral: true });

    const pos = player.position;
    const dur = track.duration;
    const bar = _progressBar(pos, dur);

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setAuthor({ name: "▶️ Now Playing" })
      .setTitle(track.title)
      .setURL(track.uri)
      .setDescription(bar)
      .addFields(
        { name: "Duration", value: `\`${_fmt(pos)} / ${_fmt(dur)}\``, inline: true },
        { name: "Requested by", value: `<@${track.requester}>`, inline: true }
      );
    if (track.artworkUrl) embed.setThumbnail(track.artworkUrl);
    return interaction.reply({ embeds: [embed] });
  },
};

function _fmt(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function _progressBar(pos, dur) {
  if (!dur) return "";
  const filled = Math.round((pos / dur) * 20);
  return "▬".repeat(filled) + "🔘" + "▬".repeat(20 - filled);
}
