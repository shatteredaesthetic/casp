"use strict";

function _awaitAsyncGenerator(value) { return new _AwaitValue(value); }

function _wrapAsyncGenerator(fn) { return function () { return new _AsyncGenerator(fn.apply(this, arguments)); }; }

function _AsyncGenerator(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume(key === "return" ? "return" : "next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue(value) { this.wrapped = value; }

const {
  ring
} = require("./buffers"); ////
// Constants
////
// const messages = Symbol("messages");
// const putters = Symbol("putters");
// const takers = Symbol("takers");


function CreateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    let r = Math.random() * 16 | 0,
        v = c === "x" ? r : r & 0x3 | 0x8;
    return v.toString(16);
  });
} ////
// Channel
////


function Channel(buffer, xf) {
  const END = Symbol("Channel/END");
  const messages = buffer;
  const putters = ring(32);
  const takers = ring(32);
  const racers = ring(32);
  let pipeOuts = [];
  let pipeClose = true;

  let pipeXF = x => x;

  let closed = false;

  function pump() {
    if (racers.length > 0 && messages.length > 0) {
      let msg = messages.remove();
      let racer = racers.remove();
      msg instanceof Error ? setImmediate(racer.reject, [chan, msg]) : setImmediate(racer.resolve, [chan, xf(msg)]);
    }

    if (pipeOuts.length > 0 && messages.length > 0) {
      let msg = messages.remove();
      pipeOuts.forEach(output => output.put(pipeXF(msg)));
    }

    while (putters.length > 0 && takers.length > 0 && messages.length > 0) {
      let msg = messages.remove();
      let putter = putters.remove();
      let taker = takers.remove();

      if (msg instanceof Error) {
        setImmediate(taker.reject, msg);
        setImmediate(putter.reject, msg);
      } else {
        setImmediate(taker.resolve, xf(msg));
        setImmediate(putter.resolve, xf(msg));
      }
    }
  }

  function put(value) {
    if (value === END) return close();
    messages.add(value);
    return new Promise((resolve, reject) => {
      putters.add({
        resolve,
        reject
      });
      pump();
    });
  }

  function take() {
    return new Promise((resolve, reject) => {
      takers.add({
        resolve,
        reject
      });
      pump();
    });
  }

  function stake() {
    if (messages.length) {
      const msg = messages.remove();
      const putter = putters.remove();
      msg instanceof Error ? putter.reject(msg) : putter.resolve(msg);
      return xf(msg);
    }

    return false;
  }

  function sput(value) {
    if (takers.length) {
      const taker = takers.remove();
      value instanceof Error ? taker.reject(value) : taker.resolve(xf(value));
      return true;
    }

    return false;
  }

  function race() {
    return new Promise((resolve, reject) => {
      if (messages.length) {
        const msg = messages.remove();
        msg instanceof Error ? setImmediate(reject, [chan, msg]) : setImmediate(resolve, [chan, xf(msg)]);
      }

      racers.add({
        resolve,
        reject
      });
      pump();
    });
  }

  function cancelRace() {
    if (racers.length) racers.remove().reject();
  }

  function pipe(output, {
    keepOpen,
    transform
  } = {}) {
    pipeOuts.push(output);
    keepOpen && (pipeClose = !keepOpen);
    transform && (pipeXF = transform);
  }

  function demux(inputs, keepOpen = false) {
    inputs.forEach(input => input.pipe(chan, {
      keepOpen
    }));
    return chan;
  }

  function mux(outputs, keepOpen = false) {
    pipeOuts = pipeOuts.concat(outputs);
    pipeClose = !keepOpen;
  }

  function remove() {
    if (pipeClose) {
      pipeOuts.forEach(output => output.close());
    }

    pipeOuts = [];

    pipeXF = x => x;

    pipeClose = true;
  }

  function close() {
    closed = true;
    remove();
    return false;
  }

  const chan = {
    END,
    id: CreateUUID(),

    get length() {
      return messages.length;
    },

    [Symbol.asyncIterator]() {
      return _wrapAsyncGenerator(function* () {
        while (true) yield take();
      })();
    },

    close,

    isClosed() {
      return closed;
    },

    take,
    stake,
    put,
    sput,
    race,
    cancelRace,
    pipe,
    demux,
    mux,
    remove
  };
  return chan;
}

function alts(...chs) {
  const alt = chans => Promise.race(chans.map(ch => ch.race()));

  const p = alt(chs).then(([ch, val]) => {
    chs.forEach(c => c.id !== ch.id && c.cancelRace());
    return [ch, val];
  });
  p[Symbol.asyncIterator] = /*#__PURE__*/_wrapAsyncGenerator(function* () {
    yield p;

    while (true) yield alt(chs);
  });
  return p;
}

function take(ch) {
  const p = ch.take();
  p[Symbol.asyncIterator] = /*#__PURE__*/_wrapAsyncGenerator(function* () {
    yield p;

    while (true) yield ch.take();
  });
  return p;
}

function chan(...args) {
  let buf = ring(32),
      xf = x => x;

  if (args.length === 2) return new Channel(...args);

  if (args.length === 1) {
    if (typeof args[0] === "function") xf = args[0];else buf = args[0];
  }

  return new Channel(buf, xf);
}

module.exports = {
  alts,
  chan,
  Channel,
  close: ch => ch.close(),
  demux: (ch, inputs, keepOpen = false) => ch.demux(inputs, keepOpen),
  mux: (ch, outputs, keepOpen = false) => ch.mux(outputs, keepOpen),
  pipe: (input, output, opts = {}) => input.pipe(output, opts),
  put: (ch, val) => ch.put(val),
  sput: (ch, val) => ch.sput(val),
  stake: ch => ch.stake(),
  take
};