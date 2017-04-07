'use strict';

const debug = require('debug')('question-bot');
const slack = require('slack');
const storage = require('./lib/storage');
const config = require('./config.json');

const token = config.slack_token;
const groupName = config.group_name;

let bot = slack.rtm.client();
let postTo;

setup();

function setup() {
  debug(`Starting question-bot posting to ${groupName}`);

  bot.started(data => {
    bot.self = { id: data.self.id, name: data.self.name };

    const slackGroup = data.groups.find(g => g.name === groupName);
    if (!slackGroup) {
      throw new TypeError(`question-bot is not a member of ${groupName}.`);
    }

    postTo = slackGroup.id;

    debug('question-bot initialized!');

    bot.message(data => handleMessage(data));
  });

  bot.listen({ token });
}

function handleMessage(message) {
  if (!isDM(message)) return;

  if (message.subtype === 'message_changed') {
    debug('Updating message...');
    updateMessage(message.previous_message.ts, message.message);
    return;
  }

  if (message.subtype === 'message_deleted') {
    // TODO: handle deleted messages
    return;
  }

  if (message.subtype || message.bot_id) return;

  debug('Handling message...');
  saveMessage(message);
}

function saveMessage(message) {
  isHandled(message, (err, handled) => {
    if (handled) {
      debug('Message handled from before');
      return;
    }

    const msg = {
      token,
      channel: postTo,
      text: 'A new question has been posted:',
      attachments: [
        { text: message.text }
      ],
      as_user: true // This will post the message as the authenticated bot.
    };

    debug(`Posting message to #${groupName}...`);
    slack.chat.postMessage(msg, (err, data) => {
      if (err) {
        debug('Slack posting error', err);
        return;
      }

      storage.store(message, data);
      replyToUser(message);
    })
  });
}

function replyToUser(message) {
  const msg = {
    token,
    channel: message.channel,
    text: 'Your question has been posted :raised_hands:',
    as_user: true
  };

  debug('Posting reply to user...');
  slack.chat.postMessage(msg, (err, res) => {
    if (err) {
      debug('Slack posting error:', err);
    }
  });
}

function updateMessage(ts, message) {
  storage.read(message.ts, (err, data) => {
    if (err) throw err;

    slack.chat.update({
      token,
      ts: data.posted_to.ts,
      channel: data.posted_to.channel,
      text: 'A new question has been posted:',
      attachments: [
        { text: message.text }
      ],
      as_user: true
    }, (err, _data) => console.log(err, _data));
  });
}

function isHandled(message, callback) {
  storage.read(message.ts, (err, data) => {
    if (err) {
      return callback(err);
    }

    callback(null, !!data);
  });
}

function isDM(message) {
  return message.channel[0] === 'D';
}
