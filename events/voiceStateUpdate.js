module.exports = {
  name: "voiceStateUpdate",
  execute(oldState, newState, bot) {
    const queue = bot.queues.get(oldState.guild.id);
    if (!queue) return;

    const botChannel = oldState.guild.members.me?.voice.channel;
    if (!botChannel) return;

    // If bot was moved or disconnected
    if (oldState.id === oldState.client.user.id && !newState.channelId) {
      queue.destroy();
      bot.queues.delete(oldState.guild.id);
      return;
    }

    // Auto-pause/resume when everyone leaves/joins
    const members = botChannel.members.filter((m) => !m.user.bot);
    if (members.size === 0 && queue.playing && !queue.paused) {
      queue.pause();
      queue.textChannel.send({ content: "⏸️ Everyone left — paused. I'll resume when someone joins." }).catch(() => {});
    } else if (members.size > 0 && queue.paused) {
      queue.resume();
      queue.textChannel.send({ content: "▶️ Someone joined — resuming!" }).catch(() => {});
    }
  },
};
