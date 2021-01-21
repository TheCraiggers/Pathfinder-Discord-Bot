var helpMessage = `
\`\`\`
Most commands follow the '!omni <verb> <noun> <target> <properties>' pattern
Verbs: add, set, remove, show, roll
Nouns: tracker, player, effect, enemy, time, shield, property, owner
Targets: names of players or enemies (quotes required if there are spaces), !players, !enemies, !everybody, !everyone
Properties: used for setting durations, hit points, etc. AC, HP, etc.

Some commands are typed often so shorter aliases are provided for them. This doesn't mean the longer version doesn't work though!

# Aliases
!roll <stat>            (Roll the player's given stat that typed this and display it)
!roll <stat1>:<stat2>   (Roll the player's stat2 and put the results in stat1)
!init                   (Roll Perception stat and save it as your Initiative)
!init Stealth           (Roll the Stealth stat and save it as your Initiave)
!heal Bob 5
!damage Bob 5

# Dice rolling
See https://greenimp.github.io/rpg-dice-roller/guide/notation/dice.html for help with dice notation and dice functions.

# Stats:
Characters can have various stats, whatever you want to track. HP and AC are common, but other things can be tracked as well.

Also, stats can use dice notation and references to other stats. Just like in spreadsheets, prefixing with an equals sign
denotes a formula. For example, adding a dynamic stat called Perception could be written like:
!omni set stat Bob Perception:=1d20+Expert+WIS

After, you can do things like '!roll init:Perception' to roll your perception and set your initiative to the result. Fancy! Or even just '!init perception'
If you don't like being fancy, '!roll init:1d20+7' still works.

# Special / Reserved stats:
HP: Character health
Initiative: The chracter's rolled initiative for combat, used in tracker order
TempHP: Temporary HP. These will be consumed first when damage is dealt.
\`\`\`
`;
exampleHelpMessage = `
\`\`\`
Examples:

!omni help                                      (Displays this.)
!omni add tracker here players                  (Create an omni tracker for players in this channel.)
!omni add player Bob AC:10 HP:18/20             (Add a new player Bob controlled by the person who typed the command.)
!omni remove player Bob                         (Add a new player Bob controlled by the person who typed the command.)
!omni set player Bob AC:20 HP:15/30             (Set Bob's AC to 20 and current HP to 15 of 30.)
!omni add effect Bob Frightened 5+ rounds       (Make Bob dizzy for 5 rounds. The + causes the duration to decrease at end of turn instead of beginning.)
!omni add effect Bob sick 2 days                (Makes Bob sick for 2 days.)
!omni remove effect Bob Dizzy                   (Remove Dizzy from Bob prematurely)
!omni add effect %players Inspired 1 round      (Gives all PCs the Inspired effect)
!omni add effect %all 'On Fire' 1 round         (Makes enemies and players on fire)
!omni add effect %enemies Dumb 1 round          (Gives all enemies the dumb effect)
!omni set stat Bob init:7                       (Sets Bob's initiatve to 7)
!omni set stat Bob init:Perception              (Computes bob's perception and sets his init to that value)
\`\`\`
`
var gmHelpMessage = `
\`\`\`
GM Commands:

!omni add tracker here GM                   (Create a GM omni tracker in this channel. GM Trackers show more info than normal trackers, like enemy health.)
!omni add enemy Boss AC:40 HP:300/300 Init:1d20+10
!omni add time tracker 10min                (Moves time forward by 10 minutes)
!time 5 hours                               (!time is a shortcut)
!omni set time tracker tomorrow             (Moves time forward until it's tomorrow morning)
!omni set time tracker 13:00                (Moves time forward until it's 1pm)
!omni set stat init Bob 15                  (Change Bob's initiative to 15)
!omni set stat init Bob 15.1                (Change Bob's initiative to 15.1, useful when players tie for initiative.)
!next                                       (When in combat, move to next character's turn)
!omni set owner Bob @Bob                    (Sets the controller of the character to a specific user in Discord)
!omni roll stat Bob Perception+1d4          (Rolls Bob's perception stat and adds 1d4 to it)
\`\`\`
`;

var Moment = require('moment');
const { DiceRoll, isNumber } = require('rpg-dice-roller/lib/umd/bundle.js');
const diceRegex = /(?<diceString>{(?<diceNotation>.*?)})/g;
const botCommandRegex = /^! ?(?<keyword>(omni help|omni setup|omni|roll|r|next|heal|damage|init|time))($| )/i;

class OmniPlugin {
    constructor (client) {
        client.on('message', message => {
            if (botCommandRegex.test(message.content)) {
                handleCommand(message);
            }   
        });
        client.on('messageUpdate', (oldMessage, newMessage) => {
            if (botCommandRegex.test(newMessage.content)) {
                handleCommand(newMessage);
            }   
        });
        console.log('Successfully loaded Omni Tracker plugin.');
    }
}
module.exports = (client) => { return new OmniPlugin(client) }

//Custom errors to aid in error messages back to users
class OmniError extends Error {
    constructor(message) {
        if (!message) {
            message = "An unknown error occurred. Check your command syntax. If you're sure it's right, contact the bot administrator.";
        }
        super(message);
        this.name = this.constructor.name;
    }
}
class CharacterNotFoundError extends OmniError {
    constructor(characterName) {
        super(`The character ${characterName} was not found.`);
        this.name = this.constructor.name;
    }
}
class PropertyNotFoundError extends OmniError {
    constructor(propertyName, characterName) {
        super(`The property "${propertyName}" was not found on character ${characterName}.`);
        this.name = this.constructor.name;
    }
}
class EffectNotFoundError extends OmniError {
    constructor(effectName, characterName) {
        super(`The effect "${effectName}" was not found on character ${characterName}.`);
        this.name = this.constructor.name;
    }
}
class Property {
    /**
     * Given a parsed JSON message of a saved Property object, returns a new Property object.
     * @param {Object} botData A parsed JSON object from a property message.
     * @returns {Property}
     */
    static newPropertyFromBotData(botData) {
        if (botData.maxValue) {
            return new PropertyRange(botData.propertyName, botData.currentValue, botData.maxValue, botData.isAboveFold, botData.character, botData.dataMessage);    
        } else {
            return new Property(botData.propertyName, botData.currentValue, botData.isAboveFold, botData.character, botData.dataMessage);
        }
    }
    constructor(name, currentValue, isAboveFold, characterName, dataMessage) {
        this.propertyName = name;
        this.currentValue = currentValue;
        this.isAboveFold = isAboveFold;     //If it's always displayed along with your HP on the omni tracker. Otherwise, need to use the show player command to view
        this.dataMessage = dataMessage;
        this.character = characterName;
    }

    save() {
        return this.dataMessage.edit(JSON.stringify(this));
    }
    delete() {
        this.dataMessage.delete().catch(error => { console.error(error); });
    }

    toJSON() {
        let foo = Object.assign({}, this);  //Copy this so when we whack the datamessage below we can still save later.
        delete foo.dataMessage;             //Messages have circular references in them and we don't need them to be saved anyway.
        foo.type = "Property";
        return foo;
    }
    
    toString = function() {
        return `${this.propertyName}:${this.currentValue}`;
    }

    static translateAliasedPropertyNames(propertyName) {
        //Given an aliased property name, will return the name it should point to. Or the same string, if it's not an alias.
        switch (propertyName.toUpperCase()) {
            case 'INIT':
                return 'initiative';
            default:
                return propertyName;
        }
    }
}
Property.propertyReferencesRegex = /(?<lookupReference>[a-zA-Z]+)/g;

class PropertyRange extends Property {
    //Property ranges only make sense with numbers, so use *1 to force to a number of some sort;
    constructor(name, currentValue, maxValue, isAboveFold, character, dataMessage) {
        super(name, currentValue * 1, isAboveFold, character, dataMessage);
        this.maxValue = maxValue * 1;
    }
    
    toString = function() {
        return `${this.propertyName}:${this.currentValue}/${this.maxValue}`;
    }
}

class Effect {
    static importFromBotData(botData) {
        return new Effect(botData);
    }

    constructor({effectName = undefined, affectedCharacterName = undefined, durationInSeconds = undefined, dataMessage = undefined, endOfTurnEffect = false}) {
        this.effectName = effectName;
        this.affectedCharacterName = affectedCharacterName;
        this.dataMessage = dataMessage;
        this.endOfTurnEffect = endOfTurnEffect;
        if (durationInSeconds) {
            this.durationInSeconds = durationInSeconds;
        } else {
            this.durationInSeconds = Infinity;
        }
    }

    save() {
        return this.dataMessage.edit(JSON.stringify(this));
    }

    delete() {
        this.dataMessage.delete().catch(error => { console.error(error); });
    }

    toJSON() {
        let foo = Object.assign({}, this);  //Copy this so when we whack the datamessage below we can still save later.
        delete foo.dataMessage;             //Messages have circular references in them and we don't need them to be saved anyway.
        foo.type = "Effect";
        return foo;
    }

    /**
     * Takes a human readable duration string and translates it into a number of seconds
     * @param {String} durationString A human readable representation of a dutation such as '1 day'
     * @returns {Number} Number of seconds the duration string represents
     */
    static translateDurationStringToSeconds(durationString) {
        var durationInSeconds = 0;
        const durationRegex = /((?<duration>\d+) (?<durationUnits>(round|min|minute|hour|day|week))s?)/gi;
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
        if (durationInSeconds == 0) {
            durationInSeconds = Infinity;       //This means no duration was set, so it'll last until removed.
        }
        return durationInSeconds;
        
    }
    
    getDurationText() {
        if (this.durationInSeconds === Infinity) {
            return '';
        } else if (this.durationInSeconds >= 86400) {
            let foo = Math.round(this.durationInSeconds/86400);
            return `${foo} day${(foo>1) ? 's':''}`;
        } else if (this.durationInSeconds >= 3600) {
            let foo = Math.round(this.durationInSeconds/3600);
            return `${foo} hour${(foo>1) ? 's':''}`;
        } else if (this.durationInSeconds >= 60) {
            let foo = Math.round(this.durationInSeconds/60);
            return `${foo} minute${(foo>1) ? 's':''}`;
        } else {
            let endOfTurnEffect = (this.endOfTurnEffect ? '+':'');
            let foo = Math.round(this.durationInSeconds/6);
            return `${foo}${endOfTurnEffect} round${(foo>1) ? 's':''}`;
        }
    }
}

class Character {
    static importFromBotData(botData) {
        if (botData.enemy) {
            var newCharacter = new Enemy(botData);
        } else {
            var newCharacter = new Player(botData);
        }
        return newCharacter;
    }

    constructor({name = undefined, owner = undefined, HP = undefined, dataMessage = undefined}) {
        this.name = name;
        this.owner = owner;
        this.indent = ' '.repeat(name.length + 1);
        this.effects = {};
        this.properties = {};
        this.linkedCharacters = {};     //Pets, familiars, shields, etc
        this.dataMessage = dataMessage; 
        this.HP = HP;
    }

    /**
     * Saves the character.
     * @returns {Promise} Promise of saved message.
     */
    save() {
        return this.dataMessage.edit(JSON.stringify(this));
    }

    /**
     * Deletes the character and all effects, properties, etc.
     * @returns {Promise} Promise for the message deletion.
     */
    delete() {
        return this.dataMessage.delete().then(msg => {
            //Now that the player is deleted, clean up any remaining data messages they had
            for (const property in this.properties) {
                this.properties[property].delete();
            }
            for (const effect in this.effects) {
                this.effects[effect].delete();
            }
        }).catch(error => {
            console.error(error);
        });
    }

    toJSON() {
        let foo = Object.assign({}, this);  //Copy this so when we whack the datamessage below we can still save later.
        foo.type = 'Character';
        delete foo.dataMessage;     //Discord message objects contain circular references that trip up JSON.stringify and we don't need to save all that garbage anyway.
        delete foo.properties;      //These have their own save functions
        delete foo.effects;
        delete foo.linkedCharacters;
        return foo;
    }

    /**
     * Computes a stat or dice roll
     * @param {String} stuffToResolve String containing what the roll
     * @returns {Object} {Result: Number, HumanReadable: Outfit fit for a reply}
     */
    resolveReference(stuffToResolve) {
        // This will resolve properties and return the resolved value
        // This includes lookups for other stats, and any dice rolls that are needed.

        // First, if stuff is a simple number, just return that. No need to get fancy.
        // Otherwise, force it down to lowercase, since that's how everything is stored.
        if (!isNaN(stuffToResolve)) {
            return {result: Number(stuffToResolve), humanReadable: ''};
        } else {
            var stuff = stuffToResolve.toLowerCase();
        }

        // Loop through the property, and keep replacing properties with their contents until I run out of them
        // Get a list of all stats, sorted from biggest to smallest. This is so I find and replace "foobar" before "foo"        
        let sortedPropsList = Object.keys(this.properties).sort((a,b) => { 
            return this.properties[b].propertyName.length - this.properties[a].propertyName.length;
        });
        let dirty = true;
        let depth = 0;
        while (dirty) {
            dirty = false;
            for (const propName of sortedPropsList) {
                if (stuff.includes(propName)) {
                    dirty = true;
                    depth++;
                    // Check for division or multiplication. If so, try to wrap stuff in parens to help the users.
                    if (stuff.includes('*') || stuff.includes('/')) {
                        stuff = stuff.replace(propName, `(${this.properties[propName].currentValue})`);    
                    } else {
                        stuff = stuff.replace(propName, this.properties[propName].currentValue);
                    }
                    stuff = stuff.toLowerCase();
                    // Restart in case the new prop brought in other props with bigger names.
                    break;
                }
                if (depth > 100) {
                    throw new OmniError("Error. Self-reference detected in your stat. Aborting before universe implodes.");
                }
            }
        }
        
        // I used to require curly braces around dice notation, but that's no longer needed. If they're around, remove them.
        stuff = stuff.replace(/(\{|\})/g,'');

        // Finally, roll the dice and do the math
        const roll = new DiceRoll(stuff);
        return {result: roll.total, humanReadable: roll.output};
    }

    /**
     * Used to add a new Property to a character. Not for instantiation of a property object!
     * @param {String} propertiesString A space delimited list of properties to add. Usually at the end of a add new player/stat command.
     * @param {Message} message A Discord message object that comtained the command.
     */
    addProperty(propertiesString, message) {
        const propertiesRegex = /(?<important>!)?(?<propertyName>\w+):((?<propertyMinValue>\d+)(\/|\\)(?<propertyMaxValue>\d+)|(?<propertyValue>(=?(\w|\[|\]|\{|\}|\+|-|\/|\*|\(|\))+)))/g;
        let properties = propertiesString.matchAll(propertiesRegex);
        let reply = '';
        let promises = [];
        message.channel.startTyping();
        for (let property of properties) {
            property.groups.propertyName = Property.translateAliasedPropertyNames(property.groups.propertyName);
            if (property.groups.propertyName == 'd') {
                message.channel.stopTyping();
                throw new OmniError("The property name 'd' is reserved and cannot be used, as it is used for dice rolling notation. Please try again with a new name.");
            }
            let important = false;
            if (property.groups.important)
                important = true;
            if (property.groups.propertyValue) {        //Is it a PropertyRange or just a Property?
                if (property.groups.propertyValue.startsWith('=')) {
                    property.groups.propertyValue = property.groups.propertyValue.replace('=','');   //Dynamic stats are set as is- no resolving.
                } else {
                    const resolvedReference = this.resolveReference(property.groups.propertyValue);
                    property.groups.propertyValue = resolvedReference.result;
                    if (resolvedReference.humanReadable)
                        message.reply(`${resolvedReference.humanReadable}`);
                }
                promises.push(this.setProperty(property.groups.propertyName, property.groups.propertyValue, important));
            } else {
                promises.push(this.setPropertyRange(property.groups.propertyName, property.groups.propertyMinValue, property.groups.propertyMaxValue,important));
            }
            if (message) {
                if (property.groups.propertyName.toLowerCase() == 'hp') {
                    reply += `Health is now ${this.HP.currentHP}/${this.HP.maxHP}\n`;
                } else {
                    reply += `Property ${this.properties[property.groups.propertyName.toLowerCase()]}\n`;
                }
                
            }
        }
        Promise.all(promises).then(results => {
            message.channel.stopTyping();
            if (reply) {
                message.reply(`The following properties were set:\n${reply}`).then(msg => {
                    msg.delete(20000)
                }).catch(error => { 
                    console.error(error) 
                });
                reply = undefined;      //Sometimes this would fire twice, this at least unsures there's new messages.
            }
                
        })
    }

    /**
     * Deal damage to this character. Temp HP is subtracted first. Saves character object and/or 
     * @param {Number} amountOfDamage Amount of damage to deal to this character
     * @returns {Promise} Promise of operation
     */
    dealDamage(amountOfDamage) {
        let temphp = this.properties['temphp'];
        amountOfDamage = amountOfDamage*1;      //force to Number
        if (temphp) {
            temphp.currentValue -= amountOfDamage;
            if (temphp.currentValue <= 0) {
                //Damage was more than the TempHP remaining
                return this.setHealth(this.HP.currentHP*1 + temphp.currentValue).then(() => {
                    return temphp.delete()
                }).then(() => {
                    delete this.properties['temphp'];
                }).catch(error => {
                    console.error(error);
                })
            } else {
                //TempHP soaked all the damage. Don't need to edit the character record then!
                return temphp.save()
            }
        } else {
            //No tempHP, just deal damage.
            return this.setHealth(this.HP.currentHP*1 - amountOfDamage);
        }
    }

    /**
     * Heal this character. Saves character object.
     * @param {Number} amountOfHeal Amount of damage to heal on this character
     * @returns {Promise} Promise of data save.
     */
    healDamage(amountOfHeal) {
        return this.setHealth(this.HP.currentHP*1 + amountOfHeal*1);
    }


    /**
     * Directly sets the health of this character. Useful if you already know the exact health values.
     * @param {Number} currentHP Current HP of character
     * @param {Number} maxHP Current Max HP of character
     * @returns {Promise} Promise of data save
     */
    setHealth(currentHP, maxHP) {
        if (maxHP !== undefined)
            this.HP.maxHP = maxHP;
        else if (this.HP.maxHP == 0) {
            this.HP.maxHP = currentHP;       //Shortcut for new character creation so you can just say HP:300
        }

        if (currentHP < 0) {
            currentHP = 0;
        } else if (currentHP > this.HP.maxHP) {
            currentHP = this.HP.maxHP;
        }
        this.HP.currentHP = currentHP;
        return this.save();
    }

    /**
     * Sets the existing property on a character to a new value or creates a new Property. Automatically forces to lowercase and resolves aliases.
     * Saves the data for you and returns the Promise so you know when it's done saving.
     * 
     * @param {String} propertyName Name of the property to set. It will be forced to lowercase automatically.
     * @param {*} value Value to set the property to.
     * @param {Boolean} isAboveFold Should this property always be displayed on the tracker?
     * @returns {Promise} Promise of the new/edited Property
     */
    setProperty(propertyName, value, isAboveFold) {
        propertyName = Property.translateAliasedPropertyNames(propertyName);
        switch (propertyName.toLowerCase()) {             //Some props are so important they exist on the char object. Deal with those.
            case 'hp':
                this.setHealth(value);
                break;
            default:
                let property = this.properties[propertyName.toLowerCase()];
                if (property) {
                    //Edit existing property
                    property.currentValue = value;
                    property.isAboveFold = isAboveFold;
                    return property.save();
                } else {
                    //Create new property
                    property = new Property(propertyName, value, isAboveFold, this.name);
                    this.properties[propertyName.toLowerCase()] = property;
                    return this.dataMessage.channel.send(JSON.stringify(property)).then(msg => {
                        property.dataMessage = msg;
                    });
                }
        }
    }

    showCharacterSynopsis(channel) {
        let output = '```CSS\n';
        if (this.enemy) {
            output += `${this.name}: <${this.getAmbiguousHP()}>`;
        } else {
            output += `${this.name}: ${this.HP.currentHP}/${this.HP.maxHP}`;
        }

        for (var propertyName of Object.keys(this.properties)) {
            var property = this.properties[propertyName];
            if (property.isAboveFold)
                output += ` ${property.toString()}`;
        }
        
        output += '\n';
        for (var effectName of Object.keys(this.effects)) {
            var effect = this.effects[effectName];
            output += `${this.indent} ${effect.effectName} ${effect.getDurationText()}\n`;
        }
        output += '```';
        return channel.send(output);
    }

    setPropertyRange(propertyName, currentValue, maxValue, isAboveFold) {
        propertyName = Property.translateAliasedPropertyNames(propertyName);
        if (propertyName.toUpperCase() == 'HP') {
            this.setHealth(currentValue,maxValue);
        } else {
            let property = this.properties[propertyName.toLowerCase()];
            if (property) {
                //Edit existing property
                property.currentValue = currentValue;
                property.maxValue = maxValue;
                property.isAboveFold = isAboveFold;
                return property.save();
            } else {
                //Create new property
                property = new PropertyRange(propertyName, currentValue, maxValue, isAboveFold, this.name);
                this.properties[propertyName.toLowerCase()] = property;
                return this.dataMessage.channel.send(JSON.stringify(property)).then(msg => {
                    property.dataMessage = msg;
                });
            }
        }
    }

    removeProperty(propertyName) {
        let property = this.properties[propertyName];
        if (!property) {
            throw new PropertyNotFoundError(propertyName, this.name);
        }
        property.delete();                       //Remove data from backend
        delete this.properties[propertyName];    //Remove property from character object to keep in sync with backend
        return this;
    }

    removeEffect(effectName) {
        let effect = this.effects[effectName.toLowerCase()];
        if (effect) {
            effect.delete();
            delete this.effects[effectName];
            return this;
        } else {
            throw new EffectNotFoundError(effectName, this.name);
        }
        
    }

    /**
     * Adds a new effect to a character, or increases the duration of an existing Effect.
     * @param {String} effectName Name of the effect, such as Confused.
     * @param {String} durationString A human-readable representation of a duration such as "1 round" or "1 day". Leave blank for infinity.
     * @returns {Effect}
     */
    addEffect(effectName, durationString) {
        let endOfTurnEffect = false;
        if (durationString.indexOf('+') > 0) {
            //For now I don't care where the + sign is. it means the effect ends at the end of the char's turn.
            durationString = durationString.replace('+','');
            endOfTurnEffect = true;
        }
        let durationInSeconds = Effect.translateDurationStringToSeconds(durationString);
        let existingEffect = this.effects[effectName.toLowerCase()];
        if (existingEffect) {
            //Effect already exists. Compare durations. Highest duration stays
            if (existingEffect.durationInSeconds < durationInSeconds) {
                existingEffect.durationInSeconds = durationInSeconds;
                existingEffect.save();
            }
            return existingEffect;
        } else {
            let newEffect = this.effects[effectName.toLowerCase()] = new Effect({effectName: effectName, durationInSeconds: durationInSeconds, affectedCharacterName: this.name, endOfTurnEffect: endOfTurnEffect});
            this.dataMessage.channel.send(JSON.stringify(newEffect)).then(msg => {
                newEffect.dataMessage = msg;
                return newEffect;
            })
        }
    }
}

class Player extends Character {
    constructor({name = undefined, owner = undefined, HP = undefined, dataMessage = undefined}) {
        super({name: name, owner: owner, HP: HP, dataMessage: dataMessage});
        this.enemy = false;
        this.type = 'Player';
    }
}

class Enemy extends Character {
    constructor({name = undefined, owner = undefined, HP = undefined, dataMessage = undefined}) {
        super({name: name, owner: owner, HP: HP, dataMessage: dataMessage});
        this.enemy = true;
        this.type = 'Enemy';
    }

    getAmbiguousHP() {
        if (this.HP.maxHP) {
            let percentage = this.HP.currentHP/this.HP.maxHP;
            if (percentage <= 0) {
                return 'Dead';
            } else if (percentage < .15) {
                return 'Critical';
            } else if (percentage < .5) {
                return 'Bloodied';
            } else if (percentage < 1) {
                return 'Injured';
            } else if (percentage == 1) {
                return 'Healthy';
            } else {
                return 'Unknown?';
            }
        } else {
            //Don't want to end the universe by trying to divide by 0
            return 'Unknown?';
        }
    }
}

class OmniTracker {
    /**
     * Given a message, returns an OmniTracker object for that server.
     * @param {Message} message 
     * @returns {Promise} Promise for new OmniTracker
     */
    static getTracker(message) {
        return new Promise(function(resolve, reject) {
            OmniTracker.getBotDataMessages(message).then(data => {
                resolve(new OmniTracker(data));
            })
        });
    }

    /**
     * Givn a message will return all the data in the botdata channel
     * @param {Message} message 
     * @returns {Promise} Array of botdata
     */
    static getBotDataMessages(message) {
        return new Promise(function(resolve, reject) {
            //First, look for existing data in the Bot Data channel. If we find it, use it. Else, create it.
            let botDatum = [];
            var botDataChannel = message.guild.channels.find(msg => msg.name == 'omni-data');
            if (!botDataChannel) {
                message.reply('Please use !omni setup first!');
            } else {
                (async function getAllMessages() {
                    let lastCollection = await botDataChannel.fetchMessages({limit:100});
                    let lastSnowflake = null;
                    while (lastCollection.size > 0) {
                        for (const msg of lastCollection) {
                            let data = JSON.parse(msg[1].content); //TODO: let class functions parse their JSON
                            lastSnowflake = msg[0];
                            data.dataMessage = msg[1];
                            botDatum.push(data);
                            if (data.type == 'OmniTracker')
                                var omniData = true;
                        }
                        
                        lastCollection = await botDataChannel.fetchMessages({limit:100, before: lastSnowflake});        
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
                })();    
                    
                
            
            }
        });
    }

    /**
     * 
     * @param {Message} message Discord message that contains the command that generated the error
     * @param {Error} error If error is an OmniError type, this will message the user with a proper user-facing error message. Otherwise, a generic error message will be sent.
     */
    static handleCommonErrors(message, error) {
        if (error instanceof OmniError) {
            message.reply(error.message).catch(err => {console.error(err)});
        } else if (error.constructor.name == 'peg$SyntaxError') {
            message.reply("Invalid dice notation. Please check your syntax.").catch(err => {console.error(err)});
        } else {
            console.error(error);
            message.reply("Sorry, an unknown error occurred. Please check your command syntax.").catch(err => {console.error(err)});
        }
    }

    constructor (botData) {
        this.time;
        this.characters = [];
        this.combatCurrentInit = null;
        this.omniDataMessage = botData.omniData;
        this.combatDataMessage = botData.combatData;

        //We need to create the Character objects first since everything plugs into that
        let charactersToImport = botData.filter(datum => datum.type == 'Character');
        for (const characterToImport of charactersToImport) {
            this.characters[characterToImport.name.toLowerCase()] = Character.importFromBotData(characterToImport);
        }

        for (const data of botData) {
            switch (data.type) {
                case 'Property':
                    if (this.characters[data.character.toLowerCase()]) {
                        this.characters[data.character.toLowerCase()].properties[data.propertyName.toLowerCase()] = Property.newPropertyFromBotData(data);
                        if (data.propertyName == 'initiative') {
                            this.combat = true;
                        }
                    }
                    break;
                case 'Effect':
                    if (this.characters[data.affectedCharacterName.toLowerCase()]) {
                        this.characters[data.affectedCharacterName.toLowerCase()].effects[data.effectName.toLowerCase()] = Effect.importFromBotData(data);
                    }
                    break;
    
                case 'OmniTracker':
                    this.time = new Moment(data.date).utc();
                    this.combatCurrentInit = data.combatCurrentInit;
                    this.omniDataMessage = data.dataMessage;
                    break;
            }
        }
    }

    toJSON() {
        return { type: 'OmniTracker', date: this.time, combatCurrentInit: this.combatCurrentInit };
    }

    save() {
        this.omniDataMessage.edit(JSON.stringify(this)).catch(error => { console.error(error)});
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

    sortCharsByInit() {
        //Will return a sorted array of keys.
        var foo = this.characters;
        return Object.keys(foo).sort(function (a,b){ 
            if (foo[a].properties['initiative'] === undefined) {
                return 1;
            } else if (foo[b].properties['initiative'] === undefined) {
                return -1;
            }
            if (foo[a].properties['initiative'].currentValue == foo[b].properties['initiative'].currentValue) {
                if (foo[a].enemy) {
                    return -1;   //Enemies go first in PF2 and if they're both enemies or both PCs than who cares
                } else {
                    return 1;
                }
            } else {
                return foo[b].properties['initiative'].currentValue - foo[a].properties['initiative'].currentValue;
            }
        });
    }
    /**
     * Used for actually adding a new char into the game, not just instantiating an object!
     * @param {String} name 
     * @param {String} owner 
     * @param {Character} characterClass 
     * @returns {Character} A promise for a new character of type characterType
     * @throws {OmniError}
     */
    addNewCharacter(name, owner, characterClass) {
        var tracker = this;
        return new Promise(function(resolve, reject) {
            if (characterClass.prototype instanceof Character) {
                let newCharacter = new characterClass({name: name, owner: owner, HP: {currentHP: 0, maxHP: 0}});
                tracker.omniDataMessage.channel.send(JSON.stringify(newCharacter))
                .then(newCharacterDataMessage => {
                    newCharacter.dataMessage = newCharacterDataMessage;
                    tracker.characters[name.toLowerCase()] = newCharacter;
                    resolve(newCharacter);
                })
                .catch(error => {
                    console.error(error);
                    reject(new OmniError());
                })
            } else {
                throw "Invalid character type."
            }
        });
    }

    /**
     * 
     * @param {Number} increaseInSeconds Number of seconds to increase by. Almost always 6 for this function.
     * @param {Boolean} endOfTurn Is the the beginning or end of the character's turn? NOTE: If undefined, decreases the duration of both types of effects!
     * @param {Character} character Character to process.
     * @param {Message} message The message that invoked this command.
     */
    increaseTimeForCharacter(increaseInSeconds, endOfTurn, character, message) {
        //Combat is weird in that while a round is 6 seconds, effects don't end at the end of the round, rather the start of the character turn.
        //So we need to treat combat different, and only increase time for one character's effects at start of their turn when in combat.
        var expiredEffectsMessage = '';
        for (let effectName in character.effects) {
            let effect = character.effects[effectName];
            if (effect.endOfTurnEffect == endOfTurn || endOfTurn === undefined) {
                effect.durationInSeconds -= increaseInSeconds;
                if (effect.durationInSeconds <= 0) {
                    expiredEffectsMessage += `<@${character.owner}>, ${effectName} has ended on ${character.name}.\n`;
                    
                    effect.delete();
                    delete character.effects[effectName];
                } else {
                    effect.save();
                }
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

        //min and sec aren't natively supported, so lets do a quick translate
        if (/mins?/.test(parsed.groups.durationUnits)) {
            parsed.groups.durationUnits = 'minute';
        } else if (/secs?/.test(parsed.groups.durationUnits)) {
            parsed.groups.durationUnits = 'second';
        }

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
            this.increaseTimeForCharacter(increaseInSeconds, undefined, character, message);
        }
    }

    saveBotData() {
        //Saves the data to the bot channel
        return;
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
    }

    updateTrackers() {
        //Search all channels in this guild for Omni Trackers and update them.
        let updatedTracker = this.generateOmniTrackerMessageText();
        let updatedGMTracker = this.generateOmniTrackerMessageText(true);
        for (var channel of this.omniDataMessage.guild.channels) {
            if (channel[1].type == 'text') {
                channel[1].fetchPinnedMessages()
                .then(messages => {
                    for (var msg of messages) {
                        if (msg[1].content.startsWith('```CSS\n[Omni Tracker]')) {
                            msg[1].edit(updatedTracker)
                            .catch(console.error);
                        } else if (msg[1].content.startsWith('```CSS\n[Omni GM Tracker]')) {
                            msg[1].edit(updatedGMTracker)
                            .catch(console.error);
                        }
                    }
                })
                .catch(console.error)
            }
        }
    }

    showTrackerInChannel(message) {
        return message.channel.send(this.generateOmniTrackerMessageText());
    }

    generateOmniTrackerMessageText(isGMTracker) {
        if (isGMTracker)
            var output = '```CSS\n[Omni GM Tracker]\n';
        else 
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

        for (var characterName in characters) {
            var character = this.characters[characters[characterName]];       //ugh, again
            if (this.combat) {
                if (character.properties['initiative'] === undefined) {
                    var init = '  ';
                } else if (character.properties['initiative'].currentValue < 10) {
                    //Indent one space to make small inits line up with bigger ones. Presuming they never get over 100...
                    var init = ` ${character.properties['initiative'].currentValue}`;
                } else {
                    var init = `${character.properties['initiative'].currentValue}`;
                }
                if (this.combatCurrentInit && this.combatCurrentInit.toLowerCase() == character.name.toLowerCase()) {
                    output += `> ${init} | `;
                } else {
                    output += `  ${init} | `;
                }
            }
            output += `${character.name}:`;
            if (character.HP) {
                if (character.enemy == false || isGMTracker) {
                    output += ` ${character.HP.currentHP}/${character.HP.maxHP}`;
                } else {
                    output += ` <${character.getAmbiguousHP()}>`;
                }
            }

            for (var propertyName of Object.keys(character.properties)) {
                var property = character.properties[propertyName];
                if (property.isAboveFold)
                    output += ` ${property.toString()}`;
            }
            
            output += '\n';
            for (var effectName of Object.keys(character.effects)) {
                var effect = character.effects[effectName];
                output += `${combatIndent}${character.indent} ${effect.effectName} ${effect.getDurationText()}\n`;
            }
            
        }

        return output + '```';
    }

    /**
     * Given the Discord ID, return the character they own.
     * If they own multiple characters, return the one currently in initiative order
     * @param {Number} ID author.id of the message
     * @returns {Character}
     */
    getCharacterFromAuthorID(ID) {
        if (this.combat && this.characters[this.combatCurrentInit] && this.characters[this.combatCurrentInit].owner == ID) {
            return this.characters[this.combatCurrentInit];
        } else {
            for (var characterName in this.characters) {
                if (this.characters[characterName].owner == ID)
                    return this.characters[characterName];
            }
        }
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

const omniCommandRegex = /^!omni (?<verb>\w+) (?<noun>\w+) (?<target>('.+?'|%?\w+)) ?(?<properties>.*)?$/i;
function handleCommand(message) {
    
    //Mobile phones like putting a space after the ! for some reason. To make it easier on mobile users, remove that.
    if (message.content.startsWith('! '))
        message.content = message.content.replace(/^! /,'!');
    
    const keyword = message.content.match(botCommandRegex).groups.keyword.toLowerCase();
    switch (keyword) {
        case 'omni help':
            message.author.send(helpMessage)
            .then(function() {
                message.author.send(exampleHelpMessage);
            })
            .then(function() {
                message.author.send(gmHelpMessage);
            })
            .catch(console.error);
            return; //Return so we don't trigger the omni commands below.
        case 'omni setup':
            handleOmniSetup(message);
            return;
        case 'r':
        case 'roll':
            handleRollAliasCommands(message);
            break;
        case 'heal':
        case 'damage':
            handleChangingHP(message);
            break;
        case 'next':
            handleInitNextCommand(message);
            break;
        case 'init':
            if (message.content == '!init') {
                message.content = '!roll init:perception';
                handleRollAliasCommands(message);
            } else {
                let parsed = message.content.match(/!init (?<skill>.+)/i);
                if (parsed) {
                    message.content = `!roll init:${parsed.groups.skill.toLowerCase()}`;
                    handleRollAliasCommands(message);
                }
            }
            break;
        case 'time':
            let parsedCommand = message.content.match(/^! ?time (?<properties>.+)$/i);
            parsedCommand.groups.verb = 'add';
            handleTimeCommands(parsedCommand, message);
            break;
        case 'omni':
            const command = message.content.match(omniCommandRegex);
            if (!command) {
                message.reply('Invalid !omni command. Use !omni help if needed.')
                .catch(console.error);
                return;
            }
            //Convert command to lowercase. Target and Props will be handled in their functions as we want to stare their Names as mixed case.
            command.groups.verb = command.groups.verb.toLowerCase();
            command.groups.noun = command.groups.noun.toLowerCase();

            switch (command.groups.noun.toLowerCase()) {
                case 'enemy':
                case 'player':
                    handlePlayerCommands(command, message);
                    break;
                case 'tracker':
                    handleTrackerCommands(command, message);
                    break;
                case 'effect':
                    handleEffectCommands(command, message);
                    break;
                case 'time':
                    handleTimeCommands(command, message);
                    break;
                case 'stat':
                case 'property':
                    handlePropertyCommands(command, message);
                    break;
                case 'controller':
                case 'owner':
                    handleOwnerCommand(command, message);
                    break;
                default:
                    message.reply('Invalid !omni command. Use !omni help if needed.')
                    .catch(console.error);
            
            }
            break;
    }
    
    
}

function handleTrackerCommands(command, message) {
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
                let isGMTracker = false;
                if (command.groups.properties.toLowerCase() == 'gm')
                    isGMTracker = true;

                omniTracker = new OmniTracker(data);
                return message.channel.send(omniTracker.generateOmniTrackerMessageText(isGMTracker));
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

function handlePlayerCommands(command, message) {
    switch (command.groups.verb) {
        case 'remove':
            gmOnlyCommand(message)
            .then(function() {
                return OmniTracker.getBotDataMessages(message);
            })
            .then(data => {
                var tracker = new OmniTracker(data);
                command.groups.target = command.groups.target.toLowerCase();
                let promises = [];
                if (command.groups.target == '%enemies') {
                    for (characterName in tracker.characters) {
                        let character = tracker.characters[characterName];
                        if (character.enemy) {
                            promises.push(character.delete());
                        }
                    }
                } else {
                    let character = tracker.characters[command.groups.target];
                    if (character) {
                        promises.push(character.delete());
                    } else {
                        message.reply(`Couldn't find a character with the name ${command.groups.target}. Please check your spelling!`)
                        .catch(error => {
                            console.error(error);
                        })
                        return;
                    }
                }
                //Now that everything is being deleted, wait and update the channel when done.
                Promise.all(promises).then(data => {
                    return OmniTracker.getBotDataMessages(message)
                }).then(data => {
                    var tracker = new OmniTracker(data);
                    tracker.showTrackerInChannel(message);
                    tracker.updateTrackers();
                    tracker.saveBotData();
                })
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
                var characterName = command.groups.target.replace(/'/g,"");

                if (command.groups.noun == 'player') {
                    var characterType = Player;
                } else if (command.groups.noun == 'enemy') {
                    gmOnlyCommand();
                    var characterType = Enemy;
                } else {
                    throw new OmniError("Invalid command. Need to specify if you're adding a Player or an Enemy!");
                }

                if (tracker.characters[characterName]) {
                    throw new OmniError(`A character with the name ${characterName} already exists!`);
                }
                tracker.addNewCharacter(characterName, message.author.id, characterType)
                .then(newCharacter => {
                    if (command.groups.properties) {
                        newCharacter.addProperty(command.groups.properties, message);
                    }
                    tracker.updateTrackers();
                    message.reply(`Added new character ${characterName}`);
                    tracker.characters[characterName.toLowerCase()].showCharacterSynopsis(message.channel);
                })    
            })
            .catch(error => {
                OmniTracker.handleCommonErrors(message, error);
            });
            break;
        case 'show':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                let character = tracker.characters[command.groups.target.toLowerCase()];
                if (!character) {
                    throw new CharacterNotFoundError(command.groups.target);
                } else {
                    if (character.enemy) {
                        gmOnlyCommand();
                    }
                    let output = '```JSON\n';
                    output += `Name: ${character.name}\n\n`;
                    for (propertyName in character.properties) {
                        output += `${character.properties[propertyName]}\n`;
                    }
                    output += '```';
                    message.reply(output).catch(error => {console.error(error)});
                }
            }).catch(error => {
                OmniTracker.handleCommonErrors(message,error);
            })
            break;

        default:
            message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
            .catch(console.error);
    }
}

function handleEffectCommands(command, message) {
    switch (command.groups.verb) {
        case 'add':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                var characterName = command.groups.target.toLowerCase().replace(/'/g,"");
                const effectRegex = /^(?<effectName>('.+?'|\w+))(?<durationInfo>.*)$/i;

                let effect = command.groups.properties.match(effectRegex);
                if (effect) {
                    effect.groups.effectName = effect.groups.effectName.replace(/'/g,"");
                    switch (command.groups.target.toLowerCase()) {
                        case '%players':
                            for (characterName in tracker.characters) {
                                let character = tracker.characters[characterName];
                                if (!character.enemy) {
                                    character.addEffect(effect.groups.effectName, effect.groups.durationInfo);
                                    character.showCharacterSynopsis(message.channel);
                                }
                            }
                            break;
                        case '%enemies':
                            for (characterName in tracker.characters) {
                                let character = tracker.characters[characterName];
                                if (character.enemy) {
                                    character.addEffect(effect.groups.effectName, effect.groups.durationInfo);
                                    character.showCharacterSynopsis(message.channel);
                                }
                            }
                            break;
                        case '%all':
                            for (characterName in tracker.characters) {
                                let character = tracker.characters[characterName];
                                character.addEffect(effect.groups.effectName, effect.groups.durationInfo);
                                character.showCharacterSynopsis(message.channel);
                            }
                            break;
                        default:
                            tracker.characters[characterName].addEffect(effect.groups.effectName, effect.groups.durationInfo);
                            tracker.characters[characterName].showCharacterSynopsis(message.channel);
                            break;
                    }
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
                    var characterName = command.groups.target.replace(/'/g,"");
                    const effectRegex = /^(?<effectName>('.+?'|\w+))$/;
                    
                    let effect = command.groups.properties.match(effectRegex);

                    if (effect) {
                        effect.groups.effectName = effect.groups.effectName.replace(/'/g,"");
                        switch (command.groups.target.toLowerCase()) {
                            case '%players':
                                for (characterName in tracker.characters) {
                                    let character = tracker.characters[characterName];
                                    if (!character.enemy) {
                                        character.removeEffect(effect.groups.effectName);
                                        character.showCharacterSynopsis(message.channel);
                                    }
                                }
                                break;
                            case '%enemies':
                                for (characterName in tracker.characters) {
                                    let character = tracker.characters[characterName];
                                    if (character.enemy) {
                                        character.removeEffect(effect.groups.effectName);
                                        character.showCharacterSynopsis(message.channel);
                                    }
                                }
                                break;
                            case '%all':
                                for (characterName in tracker.characters) {
                                    let character = tracker.characters[characterName];
                                    character.removeEffect(effect.groups.effectName);
                                    character.showCharacterSynopsis(message.channel);
                                }
                                break;
                            default:
                                tracker.characters[characterName.toLowerCase()].removeEffect(effect.groups.effectName.toLowerCase());
                                tracker.characters[characterName.toLowerCase()].showCharacterSynopsis(message.channel);
                                break;
                        }
                        tracker.saveBotData();
                        tracker.updateTrackers();
                    } else {
                        message.reply('Invalid effect command.')
                        .catch(console.error);
                    }
                })
                .catch(error => {
                    OmniTracker.handleCommonErrors(message,error);
                });
                break;

        default:
                message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
                .catch(console.error);

    }
}

function handleTimeCommands(command, message) {
    gmOnlyCommand(message)
    .then(function() {
        switch (command.groups.verb) {
            case 'add':
                OmniTracker.getBotDataMessages(message)
                .then(data => {
                    var tracker = new OmniTracker(data);
    
                    tracker.increaseTime(command.groups.properties, message);
                    tracker.save();
                    tracker.updateTrackers();
                })
                .catch(console.error);
                break;
        
                default:
                    message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
                    .catch(console.error);
    
        }  
    })
}

const rollPropertyRegex = /(((?<destinationStat>\w+):)?)?(?<sourceStat>\S+)(?<rollComment>.*)$/;
function handlePropertyCommands(command, message) {
    switch (command.groups.verb) {
        case 'add':
        case 'set':
            OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                var characterName = command.groups.target.toLowerCase().replace(/'/g,"");
                
                if (tracker.characters[characterName]) {
                    tracker.characters[characterName].addProperty(command.groups.properties, message);
                    tracker.saveBotData();
                    tracker.updateTrackers();
                } else {
                    message.reply(`Player ${command.groups.target} could not be found.`)
                    .catch(console.error);
                }
            })
            .catch(error => {
                console.error(error);
                OmniTracker.handleCommonErrors(message, error);
            });
            break;

            case 'remove':
                OmniTracker.getBotDataMessages(message)
                .then(data => {
                    let tracker = new OmniTracker(data);
                    try {
                        let characterName = command.groups.target.toLowerCase().replace(/'/g,"");
                        let character = tracker.characters[characterName];
                        if (!character) {
                            throw new CharacterNotFoundError(characterName);
                        }
                        let propertyNamesToDelete = command.groups.properties.toLowerCase().matchAll(/(?<propertyName>\w+)/g);
                        for (property of propertyNamesToDelete) {
                            property.groups.propertyName = Property.translateAliasedPropertyNames(property.groups.propertyName);
                            character.removeProperty(property.groups.propertyName);
                            message.reply(`Removing property ${property.groups.propertyName} from character ${characterName}`).catch(err => {console.error(err)});
                        }
                    } catch (e) {
                        OmniTracker.handleCommonErrors(message, e);
                    }
                    tracker.saveBotData();
                    tracker.updateTrackers();
                });
                break;
            case 'roll':
                OmniTracker.getTracker(message).then(tracker => {
                    let character = tracker.characters[command.groups.target.toLowerCase()];
                    if (!character) {
                        throw new CharacterNotFoundError(command.groups.target);
                    }
                    const stuffToRoll = command.groups.properties.match(rollPropertyRegex);
                    const output = character.resolveReference(stuffToRoll.groups.sourceStat);
                    if (isNaN(output.result)) {
                        throw "Did not get number from resolve reference";
                    }
                    if (stuffToRoll.groups.destinationStat) {
                        character.setProperty(stuffToRoll.groups.destinationStat, output.result).then(function() {
                            message.reply(`\`\`\`${stuffToRoll.groups.destinationStat} for ${character.name} has been set to ${output.result};${stuffToRoll.groups.rollComment}\n${output.humanReadable}\`\`\``)
                        }).catch(console.error);
                    } else {
                        message.reply(`\`\`\`${stuffToRoll.groups.sourceStat} for ${character.name} is ${output.result};${stuffToRoll.groups.rollComment}\n${output.humanReadable}\`\`\``)
                        .catch(console.error);
                    }
                }).catch(error => {
                    OmniTracker.handleCommonErrors(message,error);
                });
                break;


        default:
            message.reply(`Sorry, I don't know how to ${command.groups.verb} a ${command.groups.noun} yet.`)
            .catch(console.error);

    }  
}
const rollCommandRegex = /^!r(oll)? (((?<destinationStat>\w+):)?)?(?<sourceStat>\S+)(?<rollComment>.*)$/;
const diceNotationRegex = /^!r(oll)? (?<diceNotation>\S+d\d(\S+)?)(?<rollComment>.*)$/i;
function handleRollAliasCommands(message) {
    const command = message.content.match(rollCommandRegex);

    if (!command) {
        message.reply('Invalid command!')
        .catch(console.error);
    } else {
        OmniTracker.getBotDataMessages(message)
            .then(data => {
                var tracker = new OmniTracker(data);
                //Get the character for the message author so we know who's stat to roll
                character = tracker.getCharacterFromAuthorID(message.author.id);
                const output = character.resolveReference(command.groups.sourceStat);
                if (isNaN(output.result)) {
                    throw "Invalid reference.";
                }
                if (command.groups.destinationStat) {
                    character.setProperty(command.groups.destinationStat, output.result);
                    message.reply(`\`\`\`${command.groups.destinationStat} for ${character.name} has been set to ${output.result};${command.groups.rollComment}\n${output.humanReadable}\`\`\``)
                    .catch(console.error);
                } else {
                    message.reply(`\`\`\`${command.groups.sourceStat} for ${character.name} is ${output.result};${command.groups.rollComment}\n${output.humanReadable}\`\`\``)
                    .catch(console.error);
                }
                tracker.saveBotData();
                tracker.updateTrackers();
            })
            .catch(error => {
                    OmniTracker.handleCommonErrors(message, error);
            });
        
    }
}

function handleInitNextCommand(message) {
    gmOnlyCommand();
    OmniTracker.getBotDataMessages(message)
            .then(data => {
                let tracker = new OmniTracker(data);

                let sortedCharacterNames = tracker.sortCharsByInit();
                if (tracker.combatCurrentInit === undefined) {
                    tracker.combatCurrentInit = sortedCharacterNames[0];
                } else {
                    tracker.increaseTimeForCharacter(6, true, tracker.characters[tracker.combatCurrentInit], message);
                    for (let i = 0; i < sortedCharacterNames.length; i++) {
                        if (sortedCharacterNames[i] == tracker.combatCurrentInit) {
                            if (i+1 >= sortedCharacterNames.length || tracker.characters[sortedCharacterNames[i+1]].properties['initiative'] == undefined) {      //Are we at the end of the list?
                                tracker.combatCurrentInit = sortedCharacterNames[0];                                                                            //Reached end of character list, wrap around
                            } else {
                                tracker.combatCurrentInit = sortedCharacterNames[i+1];
                            }
                            break;  //Don't need to keep looking, we get what we needed
                        }
                    }
                }
                let suffix = "'s";
                let character = tracker.characters[tracker.combatCurrentInit];
                if (character.name.endsWith('s')) {
                    suffix = "'";
                }
                tracker.increaseTimeForCharacter(6, false, character, message);        //each round is 6 seconds
                message.channel.send(`Hey <@${character.owner}> it's ${character.name}${suffix} turn!`);

                tracker.save();
                tracker.updateTrackers();
                tracker.showTrackerInChannel(message);
            })
            .catch(error => {
                console.error(error);
                message.reply('Something went wrong when changing init. What did you do?!')
                .catch(console.error);
            });
}

const changeHpRegex = /^!(?<heal_or_damage>(heal|damage)) (?<target>('.+?'|\w+)) (?<delta>\d+)$/i;

function handleChangingHP(message) {
    OmniTracker.getBotDataMessages(message)
        .then(data => {
            let tracker = new OmniTracker(data);
            let parsed = message.content.toLowerCase().match(changeHpRegex);

            if (!parsed) {
                message.reply('Invalid command syntax!');
                return;
            }

            let character = tracker.characters[parsed.groups.target];
            if (!character) {
                throw new CharacterNotFoundError(parsed.groups.target);
            } else {
                if (parsed.groups.heal_or_damage == 'damage') {
                    var damageFunctionPromise = character.dealDamage(parsed.groups.delta);
                } else {
                    var damageFunctionPromise = character.healDamage(parsed.groups.delta);
                }
                damageFunctionPromise.then(() => {
                    tracker.updateTrackers();
                    character.showCharacterSynopsis(message.channel);
                    if (character.enemy && character.HP.currentHP == 0) {
                        //Character was an enemy who died, remove and check to see if combat ends
                        character.delete().then(() => {
                            delete tracker.characters[parsed.groups.target.toLowerCase()];
                            return message.reply(`Enemy ${character.name} removed from combat.`);
                        }).then(() => {
                            let enemiesAlive = false;
                            for (characterName in tracker.characters) {
                                if (tracker.characters[characterName].enemy)
                                    enemiesAlive = true;
                            }
                            if (!enemiesAlive) {
                                tracker.combat = false;
                                delete tracker.combatCurrentInit;
                                tracker.save();
                                message.channel.send('No more enemies; ending combat.').catch(error => {console.error(error)});
                                for (characterName in tracker.characters) {
                                    if (tracker.characters[characterName].properties['initiative']) {
                                        tracker.characters[characterName].properties['initiative'].delete();
                                        delete tracker.characters[characterName].properties['initiative'];
                                    }
                                }
                                tracker.updateTrackers();
                            }
                        })
                    }
                })
            }
        }).catch(error => {
            OmniTracker.handleCommonErrors(message, error);
        });   
}

function handleOmniSetup(message) {
    const channelCategoryName = 'PF2e Helper Bot Data';
    const dataChannelName = 'omni-data';
    let gmRole = message.guild.roles.find(role => role.name == 'GM');
    let botChannelCategory = message.guild.channels.find(category => category.name == channelCategoryName);
    let botDataChannel = message.guild.channels.find(msg => msg.name == dataChannelName);

    if (!gmRole) {
        message.guild.createRole({name: 'GM'}).catch(error => {console.error(error)});
    }

    new Promise(function(resolve, reject) {
        if (botChannelCategory) {
            resolve(botChannelCategory);
        } else {
            resolve (message.guild.createChannel(channelCategoryName, {
                type: 'category',
                permissionOverwrites: [{
                    id: message.guild.id,
                    deny: ['READ_MESSAGES']
                },
                {
                    id: message.client.user,
                    allow: ['READ_MESSAGES']
                }],
            }));
        }
    })
    .then(categoryChannel => {
        if (botDataChannel) {
            return botDataChannel;
        } else {
            return message.guild.createChannel(dataChannelName, {
                type: 'text',
                parent: categoryChannel
            })
        }
    })
    .then(console.log)
    .catch(console.error);
}

const getOwnerIdRegex = /<@!(?<ownerID>\d+)>/;
function handleOwnerCommand(command, message) {
    gmOnlyCommand();
    OmniTracker.getBotDataMessages(message)
            .then(data => {
                let tracker = new OmniTracker(data);

                let character = tracker.characters[command.groups.target.toLowerCase()];
                if (!character) {
                    throw new CharacterNotFoundError(command.groups.target);
                } 
                
                let ownerID = command.groups.properties.match(getOwnerIdRegex);
                if (ownerID) {
                    character.owner = ownerID.groups.ownerID;
                    character.save().then(msg => {
                        return message.reply("Owner successfully set.");
                    }).then(msg => {
                        return msg.delete(20000);
                    }).catch(error => {
                        console.error(error);
                    })

                }
            })
            .catch(error => {
                OmniTracker.handleCommonErrors(message, error);
            });
}
