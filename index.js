const Discord = require('discord.js');
const client = new Discord.Client();

const discordToken = process.env.DISCORD_TOKEN;
if (!discordToken)
    throw "No discord token found!";

console.log('woo');

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
