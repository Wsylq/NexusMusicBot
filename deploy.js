require("dotenv").config();
const { REST, Routes } = require("@discordjs/rest");
const { readdirSync } = require("fs");
const path = require("path");

const commands = readdirSync(path.join(__dirname, "commands"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => require(path.join(__dirname, "commands", f)).data.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.token);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash commands globally...`);
    await rest.put(Routes.applicationCommands(process.env.clientId), { body: commands });
    console.log("✅ Done!");
  } catch (err) {
    console.error(err);
  }
})();
