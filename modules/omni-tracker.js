/*
This handles time, HP, stats, and condition management in the game. To make it easier on everyone we still use 24hour days, with the sun rising at 7am and setting at 7pm.
Commands can be typed anywhere, and they will update all trackers present across all channels.

Example commands:

!omni init                      (Create an omni tracker in this channel. All trackers update together.)
!time add Bob dizzy 2 hours     (Adds the dizzy effect to Bob that will last 2 hours)
!time 10min                     (Moves time forward 10 minutes)
!time 5 hours                   (Moves time forward 5 hours)
!time 13:00                     (Moves time forward until it's 13:00)
!time tomorrow                  (Moves time forward until it's tomorrow morning)
!time remove Bob dizzy          (Removes dizzy from bob)
!time help                      (Basicially displays this)

*/

class omniPlugin {
    constructor (client) {
        client.on('message', message => {
            if (message.content.startsWith('!omni')) {
                handleCommand(message);
            }   
        });
        client.on('messageUpdate', (oldMessage, newMessage) => {
            if (newMessage.content.startsWith('!omni')) {
                handleCommand(message);
            }   
        });
        console.log('Successfully loaded Omni Tracker plugin.');
    }
}
module.exports = (client) => { return new omniPlugin(client) }

class OmniTracker {
    constructor (charData, combatData) {
        this.characters = {};
        this.time = new Date(0);

        const PCregex = /PC,(?<name>.+),(?<owner>@.+#\d+),(?<currentHP>\d+)?,(?<maxHP>\d+)?,(?<AC>\d+)/;
        const effectRegex = /EFFECT,(?<name>\w+),(?<effect>.+),(?<duration>\d+)/;
        const GMregex = /GM,(?<name>.+),(?<owner>@.+#\d+),(?<currentHP>\d+)?,(?<maxHP>\d+)?,(?<AC>\d+)/;

        var lines = charData.split('\n');
        if (lines[0] != '[Omni Tracker]') {
            throw 'Invalid Bot Data. Expected Omni Tracker data.';
        }

        for (var line of lines) {
            if (line == '[Omni Tracker]') {
                continue;
            }
            else if (line.startsWith('PC')) {
                var parsed = line.match(PCregex);
                if (!parsed) {
                    throw 'Bad data in Bot data! Expected PC, got ' + line;
                }
                parsed.groups.effects = {};
                parsed.groups.monster = false;
                this.characters[parsed.groups.name] = parsed.groups;
            } else if (line.startsWith('EFFECT')) {
                var parsed = line.match(effectRegex);
                if (!parsed) {
                    throw 'Bad data in Bot data! Expected EFFECT, got ' + line;
                }
                this.characters[parsed.groups.name].effects[parsed.groups.effect] = parsed.groups;
            } else if (line.startsWith('GM')) {
                var parsed = line.match(GMregex);
                if (!parsed) {
                    throw 'Bad data in Bot data! Expected GM, got ' + line;
                }
                parsed.groups.effects = {};
                parsed.groups.monster = true;
                this.characters[parsed.groups.name] = parsed.groups;
            }
        }
    }

    getDateText() {
        return this.time.toUTCString();
    }

    generateMessageText() {
        var output = '```CSS\n[Omni Tracker]\n';
        output += this.getDateText() + '\n\n';

        for 

        return output;
    }
}

const omniTrackerInitCommand = new RegExp('^!omni init$','i');
const findTimeTrackerRegex = new RegExp('^```css\\n\\[Omni Tracker\\] ?(?<omniTrackerName>.*)?$','mi');

function handleCommand(message) {
    if (message.content.startsWith('!omni init'))
        init(message);
    else if (/!time add/i.test(message.content))
        add(message);
}

function init(message) {

    //First, look for existing data in the Bot Data channel. If we find it, use it. Else, create it.
    botDataChannel = message.guild.channels.find(msg => msg.name == 'bot-data');
    if (!botDataChannel) {
        message.reply('Please use !setup first!');
    } else {
        botDataChannel.fetchMessages()
        .then(function(messages) {
            for (botData of messages) {
                if (botData[1].content.startsWith('[Omni Tracker]')) {
                    //Found the data. Return it!
                    return botData[1];
                }
            }
            //No Omni Tracker data found. Create it and return it!
            return botDataChannel.send('[Omni Tracker]\nPC,Plunk,@TheCraiggers#4907,10,25,18\nEFFECT,Plunk,sick,345600');
        })
        .then(function(botData){
            //Using the data, we can now construct an Omni Tracker class object and use it to generate the message output
            omniTracker = new OmniTracker(botData.content);
            console.log(omniTracker.generateMessageText());
        })
        .catch(console.error);

        /*
        //Second, lets create the message and pin it.
        command = message.content.match(omniTrackerInitCommand);
        if (!command) {
            message.channel.send('Invalid command. Usage is !omni init <name>');
        } else {
            var omniTrackerHeader = '```css\n[Omni Tracker] ' + command.groups.omniTrackerName + '\n```';
        }
        
        message.channel.send(omniTrackerHeader)
        .then(function(newMessage) {
            return newMessage.pin()
        })
        .then(function(newMessage) {
            console.log(newMessage);
        })
        .catch(console.error);


        message.channel.fetchPinnedMessages()
        .then(function(messagesCollection) {
            for (msg of messagesCollection) {
                pinnedMessageRegex = msg[1].content.match(findTimeTrackerRegex);
                if (pinnedMessageRegex) {
                    console.log(pinnedMessageRegex);
                    OmniTrackerPinnedMessageToCopy = msg[1];
                }
            }
        })
        .catch(console.error);    
*/
    }
    
}

