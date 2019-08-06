const debug = require('debug')('question-bot');
const slack = require('slack');
const WebSocket = require('ws');
const storage = require('./lib/storage');
const config = require('./config.json');

debug.enabled = true;

const token = config.slack_token;
const groupName = config.group_name;

setup();

async function setup() {
  debug(`Starting question-bot posting to ${groupName}`);
  const bot = await slack.rtm.start({ token });
  if (!bot.ok) {
    throw new Error('Could not connect to Slack RTM API');
  }

  const wss = new WebSocket(bot.url);

  wss.addListener('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'hello') {
      debug('Connected to Slack RTM API');
    }

    if (data.type !== 'message') return;
    handleMessage(data);
  });

  wss.addListener('close', (event) => {
    debug('Got close event', event);
    process.exit(1);
  });
}

function handleMessage(message) {
  if (!isDM(message)) return;

  if (message.subtype === 'message_changed') {
    debug('Updating message...');
    updateMessage(message.previous_message.ts, message.message.text);
    return;
  }

  if (message.subtype === 'message_deleted') {
    updateMessage(message.previous_message.ts, '<Deleted>');
    return;
  }

  if (message.subtype || message.bot_id) return;

  debug('Handling message...');
  saveMessage(message);
}

async function saveMessage(message) {
  if (await isHandled(message)) {
    debug('Message handled from before');
    return;
  }

  const msg = {
    token,
    channel: config.group_name,
    text: 'A new question has been posted:',
    attachments: [
      { text: message.text }
    ],
    as_user: true // This will post the message as the authenticated bot.
  };

  debug(`Posting message to #${groupName}...`);
  try {
    const data = await slack.chat.postMessage(msg);
    await storage.store(message, data);
    await replyToUser(message);
  } catch (e) {
    console.error('Slack posting error', e);
    return;
  }
}

async function replyToUser(message) {
  const msg = {
    token,
    channel: message.channel,
    text: 'Your question has been posted :raised_hands:',
    as_user: true
  };

  debug('Posting reply to user...');
  try {
    await slack.chat.postMessage(msg);
  } catch (e) {
    console.error('Reply to user error', e);
  }
}

async function updateMessage(ts, message) {
  const data = await storage.read(ts);

  try {
    await slack.chat.update({
      token,
      ts: data.posted_to.ts,
      channel: data.posted_to.channel,
      text: 'A new question has been posted:',
      attachments: [
        { text: message }
      ],
      as_user: true
    });
  } catch (e) {
    console.error('Update message error', e);
  }
}

async function isHandled(message, callback) {
  const data = await storage.read(message.ts);
  return !!data;
}

function isDM(message) {
  return message.channel[0] === 'D';
}
