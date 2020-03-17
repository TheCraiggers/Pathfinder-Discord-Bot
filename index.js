const Discord = require('discord.js');
const client = new Discord.Client();

process.env.DISCORD_TOKEN = "insertDiscordTokenHere"
const discordToken = process.env.DISCORD_TOKEN;
if (discordToken === "insertDiscordTokenHere")
    throw "No discord token found!";

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(discordToken)
.catch(console.error);

/*-------------------------------------------------------------------------------
Above is the important discord connection and event handler stuff. 
Below is also important, but it's the custom bot commands!
--------------------------------------------------------------------------------*/

require('./modules/lookup.js')(client);
require('./modules/omni-tracker.js')(client);
