/*
https://github.com/discordjs/discord.js/issues/3576

TotomInc commented on Feb 21
It is actually possible to mock discord.js data, without relying on Discord API (at least for my use-case).

I needed to mock a Message received from a TextChannel. This required me to mock the following discord.js classes, in the following order:

Discord.Client
Discord.Guild
Discord.Channel
Discord.GuildChannel
Discord.TextChannel
Discord.User
Discord.GuildMember
Discord.Message
However there is only a small trick in order to properly resolve a guild from a message.

Before instantiating a new Discord.Message and after instantiating a Discord.GuildMember, make sure to manually add the freshly created guild-member to the collection of members of the guild, like this: this.guild.members.set(this.guildMember.id, this.guildMember);.
*/

import Discord from 'discord.js';

export default class MockDiscord {
  private client!: Discord.Client;

  private guild!: Discord.Guild;

  private channel!: Discord.Channel;

  private guildChannel!: Discord.GuildChannel;

  private textChannel!: Discord.TextChannel;

  private user!: Discord.User;

  private guildMember!: Discord.GuildMember;

  private message!: Discord.Message;

  constructor() {
    this.mockClient();

    this.mockGuild();

    this.mockChannel();

    this.mockGuildChannel();

    this.mockTextChannel();

    this.mockUser();

    this.mockGuildMember();

    this.guild.members.set(this.guildMember.id, this.guildMember);

    this.mockMessage();
  }

  public getClient(): Discord.Client {
    return this.client;
  }

  public getGuild(): Discord.Guild {
    return this.guild;
  }

  public getChannel(): Discord.Channel {
    return this.channel;
  }

  public getGuildChannel(): Discord.GuildChannel {
    return this.guildChannel;
  }

  public getTextChannel(): Discord.TextChannel {
    return this.textChannel;
  }

  public getUser(): Discord.User {
    return this.user;
  }

  public getGuildMember(): Discord.GuildMember {
    return this.guildMember;
  }

  public getMessage(): Discord.Message {
    return this.message;
  }

  private mockClient(): void {
    this.client = new Discord.Client();
  }

  private mockGuild(): void {
    this.guild = new Discord.Guild(this.client, {
      unavailable: false,
      id: 'guild-id',
      name: 'mocked discord.js guild',
      icon: 'mocked guild icon url',
      splash: 'mocked guild splash url',
      region: 'eu-west',
      member_count: 42,
      large: false,
      features: [],
      application_id: 'application-id',
      afkTimeout: 1000,
      afk_channel_id: 'afk-channel-id',
      system_channel_id: 'system-channel-id',
      embed_enabled: true,
      verification_level: 2,
      explicit_content_filter: 3,
      mfa_level: 8,
      joined_at: new Date('2018-01-01').getTime(),
      owner_id: 'owner-id',
      channels: [],
      roles: [],
      presences: [],
      voice_states: [],
      emojis: [],
    });
  }

  private mockChannel(): void {
    this.channel = new Discord.Channel(this.client, {
      id: 'channel-id',
    });
  }

  private mockGuildChannel(): void {
    this.guildChannel = new Discord.GuildChannel(this.guild, {
      ...this.channel,

      name: 'guild-channel',
      position: 1,
      parent_id: '123456789',
      permission_overwrites: [],
    });
  }

  private mockTextChannel(): void {
    this.textChannel = new Discord.TextChannel(this.guild, {
      ...this.guildChannel,

      topic: 'topic',
      nsfw: false,
      last_message_id: '123456789',
      lastPinTimestamp: new Date('2019-01-01').getTime(),
      rate_limit_per_user: 0,
    });
  }

  private mockUser(): void {
    this.user = new Discord.User(this.client, {
      id: 'user-id',
      username: 'user username',
      discriminator: 'user#0000',
      avatar: 'user avatar url',
      bot: false,
    });
  }

  private mockGuildMember(): void {
    this.guildMember = new Discord.GuildMember(this.guild, {
      deaf: false,
      mute: false,
      self_mute: false,
      self_deaf: false,
      session_id: 'session-id',
      channel_id: 'channel-id',
      nick: 'nick',
      joined_at: new Date('2020-01-01').getTime(),
      user: this.user,
      roles: [],
    });
  }

  private mockMessage(): void {
    this.message = new Discord.Message(
      this.textChannel,
      {
        id: 'message-id',
        type: 'DEFAULT',
        content: 'this is the message content',
        author: this.user,
        webhook_id: null,
        member: this.guildMember,
        pinned: false,
        tts: false,
        nonce: 'nonce',
        embeds: [],
        attachments: [],
        edited_timestamp: null,
        reactions: [],
        mentions: [],
        mention_roles: [],
        mention_everyone: [],
        hit: false,
      },
      this.client,
    );
  }
}