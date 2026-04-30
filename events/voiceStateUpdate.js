module.exports = {
  name: "voiceStateUpdate",
  execute(oldState, newState, bot) {
    // Auto-pause when everyone leaves bot's channel
    const player = bot.manager.players.get(oldState.guild.id);
    if (!player) return;

    const botChannel = oldState.guild.members.me?.voice.channel;
    if (!botChannel) return;

    const members = botChannel.members.filter((m) => !m.user.bot);
    if (members.size === 0 && player.playing && !player.paused) {
      player.pause();
      const channel = bot.client.channels.cache.get(player.textChannelId);
      if (channel) channel.send({ content: "⏸️ Everyone left — paused." }).catch(() => {});
    } else if (members.size > 0 && player.paused) {
      player.resume();
      const channel = bot.client.channels.cache.get(player.textChannelId);
      if (channel) channel.send({ content: "▶️ Someone joined — resuming!" }).catch(() => {});
    }
  },
};
