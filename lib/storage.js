'use strict';

const levelup = require('levelup');
const db = levelup('./database');

exports.store = store;
function store(message, postedTo) {
  const data = {
    text: message.text,
    posted_to: {
      channel: postedTo.channel,
      ts: postedTo.ts
    }
  };

  db.put(message.ts, JSON.stringify(data), err => {
    if (err) {
      console.error(err);
      return;
    }
  });
}

exports.read = read;
function read(ts, callback) {
  db.get(ts, (err, raw) => {
    if (err) {
      if (err.notFound) {
        return callback();
      }
      return callback(err);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error('JSON Parse error', e);
    }

    callback(null, data);
  });
};
