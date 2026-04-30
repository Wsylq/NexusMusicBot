const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

async function fetchLyrics(query) {
  const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

  // Search Genius
  const searchRes = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${config.geniusAccessToken}` } }
  );
  const searchData = await searchRes.json();
  const hit = searchData.response?.hits?.[0]?.result;
  if (!hit) return null;

  // Scrape lyrics page
  const pageRes = await fetch(hit.url);
  const html = await pageRes.text();

  // Extract lyrics from data-lyrics-container divs
  const matches = [...html.matchAll(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g)];
  if (!matches.length) return null;

  const lyrics = matches
    .map(([, content]) =>
      content
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
    )
    .join("\n")
    .trim();

  return {
    title: hit.full_title,
    url: hit.url,
    thumbnail: hit.song_art_image_thumbnail_url,
    lyrics,
  };
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

    let query = interaction.options.getString("song");

    if (!query) {
      const queue = bot.queues.get(interaction.guild.id);
      if (!queue?.currentSong) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ No song playing and no query provided.")],
        });
      }
      query = queue.currentSong.title;
    }

    // Clean up title
    const cleaned = query
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/ft\.?.+$/i, "")
      .replace(/feat\.?.+$/i, "")
      .trim();

    try {
      const result = await fetchLyrics(cleaned);

      if (!result?.lyrics) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ No lyrics found for **${cleaned}**`)],
        });
      }

      const chunks = result.lyrics.match(/[\s\S]{1,4000}/g) || [];

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(result.title)
        .setURL(result.url)
        .setDescription(chunks[0]);

      if (result.thumbnail) embed.setThumbnail(result.thumbnail);

      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({
          embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(chunks[i])],
        });
      }
    } catch (err) {
      console.error("[lyrics]", err?.message || err);
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Failed to fetch lyrics.")],
      });
    }
  },
};
