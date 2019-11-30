var helpMessage = `
\`\`\`
Most commands follow the '!omni <verb> <noun> <target> <options>' pattern
Verbs: add, set, remove
Nouns: tracker, player, effect, enemy, time
Targets: names of players or enemies (quotes required if there are spaces), !players, !enemies, !everybody, !everyone
Options: used for setting durations, hit points, etc. AC, HP, etc.

Some commands are typed so often I provided shorter aliases for them. This doesn't mean the longer version doesn't work though!

Aliases:


!omni help                                      (Displays this.)
!omni add tracker here players                  (Create an omni tracker for players in this channel.)
!omni add player Bob AC:10                      (Add a new player Bob controlled by the person who typed the command.)
!omni remove player Bob                         (Add a new player Bob controlled by the person who typed the command.)
!omni set player Bob AC:20 HP:15                (Set Bob's AC to 20 and current HP to 15.)
!omni damage player Bob 5
!omni heal player Bob 5                         (Heal Bob for 5 HP.)
!omni add effect Bob dizzy 5 rounds             (Make Bob dizzy for 5 rounds.)
!omni add effect Bob sick 2 days                (Makes Bob sick for 2 days.)
!omni remove effect Bob Dizzy                   (Remove Dizzy from Bob prematurely)
!omni add effect Inspiried !players 1 round     (Gives all PCs the Inspired effect)
!omni add effect 'On Fire' !everyone 1 round    (Makes enemies and players on fire)
!omni add effect Dumb !enemies 1 round          (Gives all enemies the dumb effect)
!omni add player Bob AC:1                       (Adds +1 to Bob's AC)

\`\`\`
`
var gmHelpMessage = `
\`\`\`
GM Commands:

!omni add tracker here GM                   (Create a GM omni tracker in this channel. GM Trackers show more info than normal trackers, like enemy health.)
!omni add enemy 8 Skeleton AC:12 HP:5       (Adds 8 Skeletons to combat- will be named 'Skeleton 1' through 'Skeleton 8')
!omni add enemy 'War Boss' AC:40 HP:300
!omni add time 10min                        (Moves time forward by 10 minutes)
!omni add time 5 hours
!omni set time tomorrow                     (Moves time forward until it's tomorrow morning)
!omni set time 13:00                        (Moves time forward until it's 1pm)
!omni set init Bob 15                       (Change Bob's initiative to 15)
!omni set init Bob 15.1                     (Change Bob's initiative to 15.1, useful when players tie for initiative.)
!omni next                                  (When in combat, move to next character's turn)
\`\`\`
`;

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
        const currentInitRegex = /^CURRENT_INIT,(?<currentTurn>.+)$/;

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
                    this.combat.currentTurn = parsed.groups.currentTurn;
                }
            }
        }
    }

    getDateText() {
        //Pathfinder's calendar is basically just ours with different names. Boring, but easy!
        var monthName;
        var dayName;
        var hourName;

        switch (this.time.getUTCMonth()) {
            case 0:
                monthName = 'Abadius';
                break;
            case 1:
                monthName = 'Calistril';
                break;
            case 2:
                monthName = 'Pharast';
                break;
            case 3:
                monthName = 'Gozran';
                break;
            case 4:
                monthName = 'Desnus';
                break;
            case 5:
                monthName = 'Sarenith';
                break;
            case 6:
                monthName = 'Erastus';
                break;
            case 7:
                monthName = 'Arodus';
                break;
            case 8:
                monthName = 'Rova';
                break;
            case 9:
                monthName = 'Lamashan';
                break;
            case 10:
                monthName = 'Neth';
                break;
            case 11:
                monthName = 'Kuthona';
                break;
        }

        //Days of week
        switch (this.time.getUTCDay()) {
            case 0:
                dayName = 'Sunday';
                break;
            case 1:
                dayName = 'Moonday';
                break;
            case 2:
                dayName = 'Toilday';
                break;
            case 3:
                dayName = 'Wealday';
                break;
            case 4:
                dayName = 'Oathday';
                break;
            case 5:
                dayName = 'Fireday';
                break;
            case 6:
                dayName = 'Starday';
                break;
        }

        //Time of day. We stay vague, so hours is enough
        var hourNumber = this.time.getUTCHours();
        if (7 <  hourNumber && hourNumber < 10 ) {
            hourName = 'Morning';
        } else if (10 <  hourNumber && hourNumber < 12 ) {
            hourName = 'Late Morning';
        } else if (12 <  hourNumber && hourNumber < 15 ) {
            hourName = 'Afternoon';
        } else if (15 <  hourNumber && hourNumber < 19 ) {
            hourName = 'Evening';
        } else if (19 <  hourNumber && hourNumber < 20 ) {
            hourName = 'Dusk';
        } else if (20 <  hourNumber && hourNumber < 24 ) {
            hourName = 'Night';
        } else if (0 <  hourNumber && hourNumber < 6 ) {
            hourName = 'Night';
        } else if (6 <  hourNumber && hourNumber < 7 ) {
            hourName = 'Dawn';
        } else {
            hourName = 'Error!';
        }

        return `{${dayName}, ${this.time.getUTCDate()} ${monthName}; ${hourName}}`;
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
        if (duration >= 86400) {
            var foo = Math.round(duration/86400);
            return `${foo} day${(foo>1) ? 's':''}`;
        } else if (duration >= 3600) {
            var foo = Math.round(duration/3600);
            return `${foo} hour${(foo>1) ? 's':''}`;
        } else if (duration >= 60) {
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

    increaseTimeForCharacter(increaseInSeconds, character) {
        //Combat is weird in that while a round is 6 seconds, effects don't end at the end of the round, rather the start of the character turn.
        //So we need to treat combat different, and only increase time for one character at start of their turn.
        var expiredEffectsMessage = '';
        for (var effect of character.effects) {
            effect.duration =- increaseInSeconds;
            if (effect.duration <= 0) {
                expiredEffectsMessage =+ `${effect.effect} has ended on ${effect.name}.\n`;
            }
        }
        return expiredEffectsMessage;
    }

    increaseTime(increaseInSeconds) {
        var expiredEffectsMessage = '';
        //May want to make this its own function some day to reduce channel spam of effects all wearing off at the same time.
        for (var character of this.characters) {
            expiredEffectsMessage =+ this.increaseTimeForCharacter(increaseInSeconds, character);
        }
        return expiredEffectsMessage;
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
                if (this.combat.currentTurn == foo.name) {
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

const commandRegex = /^!omni (?<verb>\w+) (?<noun>\w+) (?<target>('.+?'|\w+)) ?(?<options>.*)?$/;

function handleCommand(message) {
    
    if (message.content.startsWith('!omni help')) {
        message.author.send(helpMessage)
        .then(function() {
            message.author.send(gmHelpMessage);
        })
        .catch(console.error);
        return;
    }
    
    var command = message.content.match(commandRegex);
    if (!command) {
        message.reply('Invalid !omni command. Use !omni help if needed.');
    }

    switch (command.groups.noun) {
        case 'tracker':
            manageTracker(command, message);
            break;
    }

}

function getBotDataMessages(message) {
    return new Promise(function(resolve, reject) {
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
                        //Found the data.
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
                        resolve(data);
                    });
                } else {
                    resolve(data);
                }
            })
        }
    });
}

function manageTracker(command, message) {
    switch (command.groups.verb) {
        case 'remove':
            message.channel.fetchPinnedMessages()
            .then(function(pinnedMessages) {
                for (var pinnedMessage of pinnedMessages) {
                    if (pinnedMessage[1].content.startsWith('```CSS\n[Omni Tracker]')) {
                        //Found the data.
                        return pinnedMessage[1].delete();
                    }
                }
                throw('Could not find a tracker to remove!');
            })
            .catch(console.error);
            break;
    
        case 'add':
            getBotDataMessages(message)
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
            break;
        default:
            message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun}`)
            .catch(console.error);
    }
}

