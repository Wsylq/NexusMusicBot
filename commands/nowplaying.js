const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Show the currently playing song"),
  async execute(interaction, bot) {
    const player = bot.manager.players.get(interaction.guild.id);
    const track = player?.current;
    if (!track) return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")], flags: 64 });

    // position comes from track.position (ms elapsed) or player.get("position")
    const pos = track.position ?? player.get?.("position") ?? 0;
    const dur = track.duration ?? 0;
    const bar = dur ? _progressBar(pos, dur) : "";

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setAuthor({ name: "▶️ Now Playing" })
      .setTitle(track.title)
      .setURL(track.uri)
      .addFields(
        { name: "Duration", value: dur ? `\`${_fmt(pos)} / ${_fmt(dur)}\`` : "`LIVE`", inline: true },
        { name: "Requested by", value: `<@${track.requester}>`, inline: true }
      );

    if (bar) embed.setDescription(bar);
    if (track.artworkUrl) embed.setThumbnail(track.artworkUrl);
    return interaction.reply({ embeds: [embed] });
  },
};

function _fmt(ms) {
  if (!ms || isNaN(ms)) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function _progressBar(pos, dur) {
  if (!dur || !pos) return "🔘" + "▬".repeat(20);
  const filled = Math.min(Math.round((pos / dur) * 20), 20);
  return "▬".repeat(filled) + "🔘" + "▬".repeat(20 - filled);
}

