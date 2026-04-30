const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { Client: GeniusClient } = require("genius-lyrics");
const config = require("../config");

const genius = new GeniusClient(config.geniusAccessToken);

function buildQueries(title, author) {
  // Clean up YouTube junk
  const cleanT = title
    .replace(/\s+(official|topic|lyrics|video|audio|hd|hq|mv)\s*$/gi, "")
    .replace(/\((?:official|lyrics|video|audio)[^)]*\)/gi, "")
    .replace(/\[(?:official|lyrics|video|audio)[^\]]*\]/gi, "")
    .replace(/\s+\bft\.\s*.+$/i, "")
    .replace(/\s+\bfeat\.\s*.+$/i, "")
    .trim();

  const cleanA = author
    .replace(/\s*-\s*Topic\s*$/i, "")
    .replace(/\s*Official\s*$/i, "")
    .trim();

  const queries = new Set();
  if (cleanT && cleanA) queries.add(`${cleanT} ${cleanA}`);
  if (cleanT && cleanA) queries.add(`${cleanA} ${cleanT}`);
  if (cleanT) queries.add(cleanT);
  if (title !== cleanT) queries.add(title);
  return [...queries].filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Get lyrics for a song")
    .addStringOption((o) =>
      o.setName("song").setDescription("Song name (leave empty to use currently playing)").setRequired(false)
    ),

  async execute(interaction, bot) {
    await interaction.deferReply();

    let title = "", author = "";
    const manualQuery = interaction.options.getString("song");

    if (manualQuery) {
      // Split "Artist - Title" if provided
      const parts = manualQuery.split(/\s*-\s*/);
      if (parts.length >= 2) {
        author = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      } else {
        title = manualQuery;
      }
    } else {
      const player = bot.manager?.players?.get(interaction.guild.id);
      const track = player?.current;
      if (!track) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ No song playing and no query provided.")],
        });
      }
      title = track.title || "";
      author = track.author || "";
    }

    const attempts = buildQueries(title, author);
    const displayQuery = attempts[0] || title;

    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(`🔍 Searching lyrics for **${displayQuery}**...`)],
    });

    let lyrics = null;
    let songTitle = displayQuery;
    let songUrl = null;
    let songArt = null;

    for (const query of attempts) {
      try {
        const searches = await genius.songs.search(query);
        if (!searches?.length) continue;
        const song = searches[0];
        lyrics = await song.lyrics();
        if (lyrics) {
          songTitle = song.title;
          songUrl = song.url;
          songArt = song.image;
          break;
        }
      } catch (err) {
        console.error(`[lyrics] attempt "${query}" failed:`, err.message);
      }
    }

    if (!lyrics) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ No lyrics found for **${displayQuery}**`)],
      });
    }

    const chunks = lyrics.match(/[\s\S]{1,4000}/g) || [];
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(songTitle)
      .setDescription(chunks[0]);

    if (songUrl) embed.setURL(songUrl);
    if (songArt) embed.setThumbnail(songArt);

    await interaction.editReply({ embeds: [embed] });

    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({
        embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(chunks[i])],
      });
    }
  },
};
