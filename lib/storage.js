'use strict';

const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./database'));

exports.store = store;
async function store(message, postedTo) {
  const data = {
    text: message.text,
    posted_to: {
      channel: postedTo.channel,
      ts: postedTo.ts
    }
  };

  try {
    await db.put(message.ts, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}

exports.read = read;
async function read(ts) {
  try {
    const raw = await db.get(ts);
    const data = JSON.parse(raw);
    return data;
  } catch (e) {
    if (e.notFound) {
      return;
    }

    throw e;
  }
};
