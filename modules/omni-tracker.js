var helpMessage = `
\`\`\`
Most commands follow the '!omni <verb> <noun> <target> <properties>' pattern
Verbs: add, set, remove, show
Nouns: tracker, player, effect, enemy, time, shield, property, shield, pet, familiar, group
Targets: names of players or enemies (quotes required if there are spaces), !players, !enemies, !everybody, !everyone
Properties: used for setting durations, hit points, etc. AC, HP, etc.

Some commands are typed often so shorter aliases are provided for them. This doesn't mean the longer version doesn't work though!

Aliases:

Examples:

!omni help                                      (Displays this.)
!omni add tracker here players                  (Create an omni tracker for players in this channel.)
!omni add player Bob AC:10                      (Add a new player Bob controlled by the person who typed the command.)
!omni remove player Bob                         (Add a new player Bob controlled by the person who typed the command.)
!omni set player Bob AC:20 HP:15/30             (Set Bob's AC to 20 and current HP to 15 of 30.)
!omni damage player Bob 5
!omni heal player Bob 5                         (Heal Bob for 5 HP.)
!omni add effect Bob dizzy 5 rounds             (Make Bob dizzy for 5 rounds.)
!omni add effect Bob sick 2 days                (Makes Bob sick for 2 days.)
!omni remove effect Bob Dizzy                   (Remove Dizzy from Bob prematurely)
!omni add effect %players Inspired 1 round      (Gives all PCs the Inspired effect)
!omni add effect %all 'On Fire' 1 round         (Makes enemies and players on fire)
!omni add effect %enemies Dumb 1 round          (Gives all enemies the dumb effect)
!omni add player Bob AC:1                       (Adds +1 to Bob's AC)
!omni roll init Bob Perception                  (Rolls a new initiative for Bog using his Perception stat)
!omni roll init Bob +7
\`\`\`
`
var gmHelpMessage = `
\`\`\`
GM Commands:

!omni add tracker here GM                   (Create a GM omni tracker in this channel. GM Trackers show more info than normal trackers, like enemy health.)
!omni add enemy 8 Skeleton AC:12 HP:5       (Adds 8 Skeletons to combat- will be named 'Skeleton 1' through 'Skeleton 8')
!omni add enemy 'War Boss' AC:40 HP:300
!omni add time tracker 10min                (Moves time forward by 10 minutes)
!omni add time tracker 5 hours
!omni set time tracker tomorrow             (Moves time forward until it's tomorrow morning)
!omni set time tracker 13:00                (Moves time forward until it's 1pm)
!omni set init Bob 15                       (Change Bob's initiative to 15)
!omni set init Bob 15.1                     (Change Bob's initiative to 15.1, useful when players tie for initiative.)
!omni next                                  (When in combat, move to next character's turn)
!omni add group 'Team Bravo'
!omni add Bob 'Team Bravo'
\`\`\`
`;

var Moment = require('moment');
const { DiceRoller } = require('rpg-dice-roller');
const roller = new DiceRoller();

class omniPlugin {
    constructor (client) {
        client.on('message', message => {
            if (message.content.startsWith('!omni')) {
                handleCommand(message);
            }   
        });
        client.on('messageUpdate', (oldMessage, newMessage) => {
            if (newMessage.content.startsWith('!omni')) {
                handleCommand(newMessage);
            }   
        });
        console.log('Successfully loaded Omni Tracker plugin.');
    }
}
module.exports = (client) => { return new omniPlugin(client) }

class Property {
    constructor(name, currentValue, isAboveFold) {
        this.name = name;
        this.currentValue = currentValue;
        this.isAboveFold = isAboveFold;     //If it's always displayed along with your HP on the omni tracker. Otherwise, need to use show player
    }
    
    toString = function() {
        return `${this.name}:${this.currentValue}`;
    }
}

class PropertyRange extends Property {
    constructor(name, currentValue, maxValue, isAboveFold) {
        super(name, currentValue, isAboveFold);
        this.maxValue = maxValue;
    }
    
    toString = function() {
        return `${this.name}:${this.currentValue}/${this.maxValue}`;
    }
}

class Character {
    static importJSON(character) {
        if (character.enemy) {
            var newCharacter = Enemy(character.name, character.owner, character.HP.currentValue, character.HP.maxValue, character.message);
        } else {
            var newCharacter = new Player(character.name, character.owner, character.HP.currentValue, character.HP.maxValue, character.message);
        }

        //Properties
        var keys = Object.keys(character.properties);
        for (let i = 0; i < keys.length; i++) {
            const property = character.properties[keys[i]];
            if (property.maxValue)
                newCharacter.properties[property.name] = new PropertyRange(property.name, property.currentValue, property.maxValue, property.isAboveFold);
            else
                newCharacter.properties[property.name] = new Property(property.name, property.currentValue, property.isAboveFold);
        }

        //Effects
        var keys = Object.keys(character.effects);
        for (let i = 0; i < keys.length; i++) {
            let effect = character.effects[keys[i]];
            if (effect.duration == null)
                effect.duration = Infinity;
            newCharacter.effects[keys[i]] = effect;
        }

        return newCharacter;
    }

    constructor(name, owner, currentHP, maxHP, dataMessage) {
        this.name = name;
        this.owner = owner;
        this.HP = new PropertyRange('HP',currentHP, maxHP);     //Even though this is a property, it's special (especially for enemies) and putting it here means I don't always have filter it out when printing props later
        this.indent = ' '.repeat(name.length + 1);
        this.effects = {};
        this.properties = {};
        this.linkedCharacters = {};     //Pets, familiars, shields, etc
        this.dataMessage = dataMessage; 
    }

    toJSON() {
        let foo = Object.assign({}, this);  //Copy this so when we whack the datamessage below we can still save later.
        foo.type = 'Character';
        foo.dataMessage = null;     //Discord message objects contain circular references that trip up JSON.stringify and we don't need to save all that garbage anyway.
        return foo;
    }

    setHealth(currentHP, maxHP) {

        this.HP.currentValue = currentHP;
        if (maxHP !== undefined)
            this.HP.maxValue = maxHP;
        return this;
    }

    setProperty(propertyName, value) {
        if (propertyName.toUpperCase() == 'HP')
            this.setHealth(value);
        else 
            this.properties[propertyName] = new Property(propertyName, value);
        return this;
    }

    setPropertyRange(propertyName, currentValue, maxValue) {
        if (propertyName.toUpperCase() == 'HP')
            this.setHealth(currentValue,maxValue);
        else 
            this.properties[propertyName] = new PropertyRange(propertyName, currentValue, maxValue);
        return this;
    }

    removeEffect(effectName) {
        delete this.effects[effectName];
        return this;
    }

    addEffect(effectName, durationString) {
        var durationInSeconds = 0;
        const durationRegex = /((?<duration>\d+) (?<durationUnits>(round|min|minute|hour|day|week))s?)/g;
        const durations = durationString.matchAll(durationRegex);
        for (const duration of durations) {
            switch (duration.groups.durationUnits) {
                case 'round':
                    durationInSeconds =+ duration.groups.duration * 6;
                    break;
                case 'min':
                case 'minute':
                    durationInSeconds =+ duration.groups.duration * 60;
                    break;
                case 'hour':
                    durationInSeconds =+ duration.groups.duration * 3600;
                    break;
                case 'day':
                    durationInSeconds =+ duration.groups.duration * 86400;
                    break;
                case 'week':
                    durationInSeconds =+ duration.groups.duration * 604800;
                    break;
                default:
                    console.error("Somehow got an invalid durationUnit past regex!");
            }
        }
        if (durationInSeconds == 0)
            durationInSeconds = Infinity;       //This means no duration was set, so it'll last until removed.

        if (this.effects[effectName]) {
            //Effect already exists. Compare durations. Highest duration stays
            this.effects[effectName].duration = Math.max(this.effects[effectName].duration, durationInSeconds);
        } else {
            this.effects[effectName] = {duration: durationInSeconds};
        }
    }
}

class Player extends Character {
    constructor(name,owner,currentHP,maxHP, dataMessage) {
        super(name, owner, currentHP,maxHP, dataMessage);
        this.enemy = false;
    }
}

class Enemy extends Character {
    constructor(name,owner,currentHP,maxHP,dataMessage) {
        super(name, owner, currentHP,maxHP,dataMessage);
        this.enemy = true;
    }
}

class OmniTracker {
    static getBotDataMessages(message) {
        return new Promise(function(resolve, reject) {
            //First, look for existing data in the Bot Data channel. If we find it, use it. Else, create it.
            var botDataChannel = message.guild.channels.find(msg => msg.name == 'bot-data');
            if (!botDataChannel) {
                message.reply('Please use !setup first!');
    
            } else {
                botDataChannel.fetchMessages()
                .then(function(messages) {
                    let botDatum = [];
                    for (const msg of messages) {
                        let data = JSON.parse(msg[1].content);
                        data.message = msg[1];
                        botDatum.push(data);
                        if (data.type == 'OmniTracker')
                            var omniData = true;
                    }
                    if (!omniData) {
                        //No Omni Tracker data found. Create it!
                        let newOmniObject = { type: 'OmniTracker', date: 0, combat: null };
                        botDataChannel.send(JSON.stringify(newOmniObject))
                        .then(function (newBotDataMessage) {
                            newOmniObject.message = newBotDataMessage;
                            botDatum.push(newOmniObject);
                            resolve(botDatum);
                        });
                    } else {
                        resolve(botDatum);
                    }
                })
            }
        });
    }

    constructor (botData) {
        this.characters = {};
        this.time;
        this.combat = null;
        this.omniDataMessage = botData.omniData;
        this.combatDataMessage = botData.combatData;

        for (const data of botData) {
            switch (data.type) {
                case 'Character':
                    this.characters[data.name] = Character.importJSON(data);
                    break;
                case 'OmniTracker':
                    this.time = new Moment(data.date).utc();
                    this.omniDataMessage = data.message;
                    break;
                case 'Combat':
                    this.combat = { currentTurn: data.currentTurn};
                    this.combatDataMessage = data.message;
                    break;
            }
        }
    }

    toJSON() {
        return { type: 'OmniTracker', date: this.time, combat: this.combat };
    }

    getDateText() {
        //Pathfinder's calendar is basically just ours with different names. Boring, but easy!
        var monthName;
        var dayName;
        var hourName;

        switch (this.time.month()) {
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
        switch (this.time.day()) {
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
        var hourNumber = this.time.hour();
        if (7 <=  hourNumber && hourNumber < 10 ) {
            hourName = 'Morning';
        } else if (10 <=  hourNumber && hourNumber < 12 ) {
            hourName = 'Late Morning';
        } else if (12 <=  hourNumber && hourNumber < 15 ) {
            hourName = 'Afternoon';
        } else if (15 <=  hourNumber && hourNumber < 19 ) {
            hourName = 'Evening';
        } else if (19 <=  hourNumber && hourNumber < 20 ) {
            hourName = 'Dusk';
        } else if (20 <=  hourNumber && hourNumber < 24 ) {
            hourName = 'Night';
        } else if (hourNumber < 7 ) {
            hourName = 'Night';
        } else if (6 <=  hourNumber && hourNumber < 7 ) {
            hourName = 'Dawn';
        } else {
            hourName = 'Error!';
        }

        return `{${dayName}, ${this.time.date()} ${monthName}; ${hourName}}`;
    }

    getAmbiguousHP() {
        var percentage = this.HP.currentValue/this.HP.maxValue;
        if (percentage < .15) {
            return 'Critical';
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
        if (duration === Infinity) {
            return '';
        } else if (duration >= 86400) {
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

    increaseTimeForCharacter(increaseInSeconds, character, message) {
        //Combat is weird in that while a round is 6 seconds, effects don't end at the end of the round, rather the start of the character turn.
        //So we need to treat combat different, and only increase time for one character's effects at start of their turn when in combat.
        var expiredEffectsMessage = '';
        for (let effectName in character.effects) {
            let effect = character.effects[effectName];
            effect.duration -= increaseInSeconds;
            if (effect.duration <= 0) {
                expiredEffectsMessage += `<@${character.owner}>, ${effectName} has ended on ${character.name}.\n`;
                delete character.effects[effectName];
            }
        }
        if (expiredEffectsMessage) {
            message.channel.send(expiredEffectsMessage)
            .catch(console.error);
        }
        return expiredEffectsMessage;
    }

    increaseTime(stringDuration, message) {
        const timeRegex = /(?<duration>(?<durationValue>\d+) ?(?<durationUnits>(minute|min|sec|second|hour|day|week|month))s?)|(?<specific>\d?\d:\d\d)|(?<abstract>(midnight|dawn|morning|noon|dusk|night|tomorrow|evening))/i;
        const parsed = stringDuration.match(timeRegex);
        const oldTime = new Moment(this.time).utc();

        if (parsed.groups.duration) {
            var duration = Moment.duration(parseInt(parsed.groups.durationValue), parsed.groups.durationUnits);
            this.time.add(duration);
        } else if (parsed.groups.specific) {
            var duration = Moment.duration(parsed.groups.specific);
            this.time.add(duration);
        } else if (parsed.groups.abstract){
            switch (parsed.groups.abstract.toUpperCase()) {
                case 'TOMORROW':
                case 'MORNING':
                    if (this.time.hour() > 7) {
                        this.time.add(1,'day').hour(7).minute(0).second(0);
                    } else {
                        this.time.hour(7).minute(0).second(0);
                    }
                    var duration = Moment.duration(this.time.diff(oldTime));
                    break;
                default:
                    message.reply(`Sorry, I don't know how to set time to ${parsed.groups.abstract} yet.`).catch(console.error);
                    break;
            }
        }
        let increaseInSeconds = duration.asSeconds();
        message.reply(`Forwarding time ${oldTime.from(this.time, true)}`)
        .catch(console.error);

        for (let characterName in this.characters) {
            const character = this.characters[characterName];
            this.increaseTimeForCharacter(increaseInSeconds, character, message);
        }
    }

    saveBotData() {
        //Saves the data to the bot channel
        this.omniDataMessage.edit(JSON.stringify(this))
        .catch(console.error);

        for (var characterName in this.characters) {
            const character = this.characters[characterName];
            const json = JSON.stringify(character);

            if (!character.dataMessage) {
                this.omniDataMessage.channel.send(json)
                    .then(message => {
                        character.dataMessage = message;
                    })
                    .catch(console.error);
            
            } else {
                character.dataMessage.edit(json)
                .catch(console.error);
            }
        }
        

        if (this.combat) {
            var combatData = `[Combat]\nCURRENT_INIT,${this.combat.currentTurn}\n`;
            for (var characterName in this.characters) {
                const char = this.characters[characterName];
                combatData += `INIT,${char.name},${char.init}\n`;
            }
            this.combatDataMessage.edit(combatData)
            .catch(console.error);
        }

    }

    updateTrackers() {
        //Search all channels in this guild for Omni Trackers and update them.
        var updatedTracker = this.generateOmniTrackerMessageText();
        for (var channel of this.omniDataMessage.guild.channels) {
            if (channel[1].type == 'text') {
                channel[1].fetchPinnedMessages()
                .then(messages => {
                    for (var msg of messages) {
                        if (msg[1].content.startsWith('```CSS\n[Omni Tracker]')) {
                            msg[1].edit(updatedTracker)
                            .catch(console.error);
                        }
                    }
                })
                .catch(console.error)
            }
        }
    }

    generateOmniTrackerMessageText() {
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
            var foo = this.characters[characters[character]];       //ugh, again
            if (this.combat) {
                if (this.combat.currentTurn == foo.name) {
                    output += `> ${foo.init} | `;
                } else {
                    output += `  ${foo.init} | `;
                }
            }
            if (foo.enemy) {
                output += `${foo.name}: <${this.getAmbiguousHP()}>\n`;
            } else {
                output += `${foo.name}: ${foo.HP.currentValue}/${foo.HP.maxValue}`;
            }

            for (var propertyName of Object.keys(foo.properties)) {
                var property = foo.properties[propertyName];
                if (property.isAboveFold)
                    output += ` ${property.toString()}`;
            }
            
            output += '\n';
            for (var effectName of Object.keys(foo.effects)) {
                var effect = foo.effects[effectName];
                output += `${combatIndent}${foo.indent} ${effectName} ${[this.getDurationText(effect.duration)]}\n`;
            }
            
        }

        return output + '```';
    }
}

function gmOnlyCommand(message) {
    //Called when a command is deemed dangerous and we want to limit its usage to users with the GM role only.
    //return true;
    return new Promise(function(resolve, reject) {
        //throw "You're not a GM. Go away."
        resolve();
    });
}

const commandRegex = /^!omni (?<verb>\w+) (?<noun>\w+) (?<target>('.+?'|\w+)) ?(?<properties>.*)?$/;
function handleCommand(message) {
    
    if (message.content.startsWith('!omni help')) {
        //Handle help first since it doesn't follow the normal verb-noun-target syntax
        message.author.send(helpMessage)
        .then(function() {
            message.author.send(gmHelpMessage);
        })
        .catch(console.error);
        return;
    }
    
    var command = message.content.match(commandRegex);
    if (!command) {
        message.reply('Invalid !omni command. Use !omni help if needed.')
        .catch(console.error);
        return;
    }

    switch (command.groups.noun) {
        case 'player':
            managePlayer(command, message);
            break;
        case 'tracker':
            manageTracker(command, message);
            break;
        case 'effect':
            manageEffects(command, message);
            break;
        case 'time':
            manageTime(command, message);
            break;
    }

}

function manageTracker(command, message) {
    switch (command.groups.verb) {
        case 'remove':
            gmOnlyCommand(message);
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
            gmOnlyCommand(message);
            OmniTracker.getBotDataMessages(message)
            .then(function(data){
                //Using the data, we can now construct an Omni Tracker class object and use it to
                //create the message and pin it.
                omniTracker = new OmniTracker(data);
                return message.channel.send(omniTracker.generateOmniTrackerMessageText());
            })
            .then(function(newMessage) {
                return newMessage.pin();
            })
            .catch(console.error);    
            break;
        case 'show':
            OmniTracker.getBotDataMessages(message)
            .then(function(data){
                //Using the data, we can now construct an Omni Tracker class object and use it to
                //create the message and pin it.
                omniTracker = new OmniTracker(data);
                return message.channel.send(omniTracker.generateOmniTrackerMessageText());
            })
            .catch(console.error);    
            break;
        default:
            message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
            .catch(console.error);
    }
}

function managePlayer(command, message) {
    switch (command.groups.verb) {
        case 'remove':
            gmOnlyCommand(message)
            .then(function() {
                OmniTracker.getBotDataMessages(message)    
            })
            .then(data => {
                var tracker = new OmniTracker(data);
                delete tracker.characters[command.groups.target];
                tracker.saveBotData();
                tracker.updateTrackers();
            })
            .catch(error => {
                message.reply(error);
                console.error(error);
            })
            break;
        case 'add':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                var characterName = command.groups.target.replace("'","").replace(',','');
                const propertiesRegex = /(?<propertyName>\w+):((?<propertyMinValue>\d+)(\/|\\)(?<propertyMaxValue>\d+)|(?<propertyValue>\w+))/g;
                tracker.characters[characterName] = new Player(characterName, message.author.id, 0, 0);    //HP will hopefully get set in the properties below. And if not, 0/0 will prompt the user.

                if (command.groups.properties) {
                    var properties = command.groups.properties.matchAll(propertiesRegex);
                    for (property of properties) {
                        if (property.groups.propertyValue)
                            tracker.characters[characterName].setProperty(property.groups.propertyName, property.groups.propertyValue);
                        else
                            tracker.characters[characterName].setPropertyRange(property.groups.propertyName, property.groups.propertyMinValue, property.groups.propertyMaxValue);
                    }
                }
                tracker.saveBotData();
                tracker.updateTrackers();
            })
            .catch(error => {
                message.reply('Sorry, there was an error. Check your syntax!');
                console.error(error);
            });
            break;
        case 'set':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                var characterName = command.groups.target.replace("'","");
                const propertiesRegex = /(?<propertyName>\w+):((?<propertyMinValue>\d+)(\/|\\)(?<propertyMaxValue>\d+)|(?<propertyValue>\w+))/g;
                if (tracker.characters[characterName]) {
                    var properties = command.groups.properties.matchAll(propertiesRegex);
                    for (property of properties) {
                        if (property.groups.propertyValue)
                            tracker.characters[characterName].setProperty(property.groups.propertyName, property.groups.propertyValue);
                        else
                            tracker.characters[characterName].setPropertyRange(property.groups.propertyName, property.groups.propertyMinValue, property.groups.propertyMinValue);
                    }
                    tracker.saveBotData();
                    tracker.updateTrackers();
                } else {
                    message.reply(`Player ${command.groups.target} could not be found.`)
                    .catch(console.error);
                }
            })
            .catch(error => message.reply(error));
            break;
        default:
            message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
            .catch(console.error);
    }
}

function manageEffects(command, message) {
    switch (command.groups.verb) {
        case 'add':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                var characterName = command.groups.target.replace("'","");
                const effectRegex = /^(?<effectName>('.+?'|\w+))(?<durationInfo>.*)$/i;

                let effect = command.groups.properties.match(effectRegex);
                if (effect) {
                    tracker.characters[characterName].addEffect(effect.groups.effectName, effect.groups.durationInfo);
                    tracker.saveBotData();
                    tracker.updateTrackers();
                } else {
                    message.reply('Invalid effect command.')
                    .catch(console.error);
                }
            })
            .catch(console.error);
            break;
        case 'remove':
                OmniTracker.getBotDataMessages(message)
                .then(data => {
                    var tracker = new OmniTracker(data);
                    var characterName = command.groups.target.replace("'","");
                    const effectRegex = /^(?<effectName>('.+?'|\w+))$/;
                    
                    let effect = command.groups.properties.match(effectRegex);
                    tracker.characters[characterName].removeEffect(effect.groups.effectName);
                    tracker.saveBotData();
                    tracker.updateTrackers();
                })
                .catch(console.error);
                break;

        default:
                message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
                .catch(console.error);

    }
}

function manageTime(command, message) {
    gmOnlyCommand(message)
    .then(function() {
        switch (command.groups.verb) {
            case 'add':
                OmniTracker.getBotDataMessages(message)
                .then(data => {
                    var tracker = new OmniTracker(data);
    
                    tracker.increaseTime(command.groups.properties, message);
                    tracker.saveBotData();               
                    tracker.updateTrackers();
                })
                .catch(console.error);
                break;
        }  
    })
}