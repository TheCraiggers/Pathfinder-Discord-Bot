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
        this.combat = null;

        const PCregex = /PC,(?<name>.+),(?<owner><@\d+>),(?<currentHP>\d+)?,(?<maxHP>\d+)?,(?<AC>\d+)/;
        const effectRegex = /EFFECT,(?<name>.+),(?<effect>.+),(?<duration>\d+)/;
        const enemyRegex = /ENEMY,(?<name>.+),(?<owner>@.+#\d+),(?<currentHP>\d+)?,(?<maxHP>\d+)?,(?<AC>\d+)/;
        const dateRegex = /^DATE,(?<date>\d+)$/;
        const initRegex = /^INIT,(?<name>.+),(?<init>\d+)$/;
        const currentInitRegex = /^CURRENT_INIT,(?<init>\d+)$/;

        var lines = charData.content.split('\n');
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
                parsed.groups.enemy = false;
                parsed.groups.indent = ' '.repeat(parsed.groups.name.length + 1);
                this.characters[parsed.groups.name] = parsed.groups;
            } else if (line.startsWith('EFFECT')) {
                var parsed = line.match(effectRegex);
                if (!parsed) {
                    throw 'Bad data in Bot data! Expected EFFECT, got ' + line;
                }
                this.characters[parsed.groups.name].effects[parsed.groups.effect] = parsed.groups;
            } else if (line.startsWith('DATE')) {
                var parsed = line.match(dateRegex);
                if (!parsed) {
                    throw 'Bad data in Bot data! Expected DATE, got ' + line;
                }
                this.time = new Date(parsed.groups.date*1);
            }
        }

        if (combatData) {
            this.combat = {};
            var lines = combatData.content.split('\n');
            for (var line of lines) {
                if (line.startsWith('ENEMY')) {
                    var parsed = line.match(enemyRegex);
                    if (!parsed) {
                        throw 'Bad data in Bot data! Expected GM, got ' + line;
                    }
                    parsed.groups.effects = {};
                    parsed.groups.enemy = true;
                    parsed.groups.indent = ' '.repeat(parsed.groups.name.length + 1);
                    this.characters[parsed.groups.name] = parsed.groups;
                } else if (line.startsWith('EFFECT')) {
                    var parsed = line.match(effectRegex);
                    if (!parsed) {
                        throw 'Bad data in Bot data! Expected EFFECT, got ' + line;
                    }
                    this.characters[parsed.groups.name].effects[parsed.groups.effect] = parsed.groups;
                } else if (line.startsWith('INIT')) {
                    var parsed = line.match(initRegex);
                    if (!parsed) {
                        throw 'Bad data in Bot data! Expected INIT, got ' + line;
                    }
                    this.characters[parsed.groups.name].init = parsed.groups.init;
                } else if (line.startsWith('CURRENT_INIT')) {
                    var parsed = line.match(currentInitRegex);
                    if (!parsed) {
                        throw 'Bad data in Bot data! Expected CURRENT_INIT, got ' + line;
                    }
                    this.combat.currentInit = parsed.groups.init;
                }
            }
        }
    }

    getDateText() {
        return this.time.toUTCString();
    }

    getAmbiguousHP(currentHP, maxHP) {
        var percentage = currentHP/maxHP;
        if (percentage < .15) {
            return 'Bloodied';
        } else if (percentage < .5) {
            return 'Bloodied';
        } else if (percentage < 1) {
            return 'Injured';
        } else if (percentage == 1) {
            return 'Healthy';
        } else {
            return 'Error?';
        }
    }

    getDurationText(duration) {
        if (duration > 86400) {
            var foo = Math.round(duration/86400);
            return `${foo} day${(foo>1) ? 's':''}`;
        } else if (duration > 3600) {
            var foo = Math.round(duration/3600);
            return `${foo} hour${(foo>1) ? 's':''}`;
        } else if (duration > 60) {
            var foo = Math.round(duration/60);
            return `${foo} minute${(foo>1) ? 's':''}`;
        } else {
            var foo = Math.round(duration/6);
            return `${foo} round${(foo>1) ? 's':''}`;
        }
    }

    sortCharsByInit() {
        //Will return a sorted array of keys.
        var foo = this.characters;
        return Object.keys(foo).sort(function (a,b){ 
            if (foo[a].init == foo[b].init) {
                if (foo[a].enemy) {
                    return -1;   //Enemies go first in PF2 and if they're both enemies or both PCs than who cares
                } else {
                    return 1;
                }
            } else {
                return foo[b].init - foo[a].init;
            }
        });
    }

    generateMessageText() {
        var output = '```CSS\n[Omni Tracker]\n';
        output += this.getDateText() + '\n\n';
        var characters = Object.keys(this.characters);
        if (this.combat) {
            var combatIndent = '     | ';
            //Need to sort by init
            characters = this.sortCharsByInit();
        } else {
            var combatIndent = '';
        }

        for (var character in characters) {
            var foo = this.characters[characters[character]];       //ugh
            if (this.combat) {
                if (this.combat.currentInit == foo.init) {
                    output += `> ${foo.init} | `;
                } else {
                    output += `  ${foo.init} | `;
                }
            }
            if (foo.enemy) {
                output += `${foo.name}: <${this.getAmbiguousHP(foo.currentHP, foo.maxHP)}>\n`;
            } else {
                output += `${foo.name}: ${foo.currentHP}/${foo.maxHP} AC:${foo.AC}\n`;
            }

            for (var effect of Object.keys(foo.effects)) {
                var bar = foo.effects[effect];
                output += `${combatIndent}${foo.indent} ${bar.effect} ${[this.getDurationText(bar.duration)]}\n`;
            }
            
        }

        return output + '```';
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
            var data = {botData: null, combatData: null};
            for (botData of messages) {
                if (botData[1].content.startsWith('[Omni Tracker]')) {
                    //Found the data. Return it!
                    data.botData = botData[1];
                } else if (botData[1].content.startsWith('[Combat]')) {
                    data.combatData = botData[1];
                }
            }
            if (!data.botData) {
                //No Omni Tracker data found. Create it!
                botDataChannel.send('[Omni Tracker]\nDATE,0')
                .then(function (newBotData) {
                    data.botData = newBotData;
                    return data;    
                });
            } else {
                return data;
            }
        })
        .then(function(data){
            //Using the data, we can now construct an Omni Tracker class object and use it to
            //create the message and pin it.
            omniTracker = new OmniTracker(data.botData, data.combatData);
            return message.channel.send(omniTracker.generateMessageText());
        })
        .then(function(newMessage) {
            return newMessage.pin();
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

