const test = require("tape");
const {
  alts,
  chan,
  close,
  demux,
  mux,
  pipe,
  put,
  sput,
  stake,
  take,
} = require("../src/channel");

test("[casp] close / isClosed", (t) => {
  const ch = chan();
  t.notOk(ch.isClosed(), "channel should be open");
  ch.close();
  t.ok(ch.isClosed(), "channel should be closed");
  const ch2 = chan();
  close(ch2);
  t.ok(ch2.isClosed(), "pointfree close should close channel");
  t.end();
});

test("[casp] length", (t) => {
  const ch = chan();
  t.equals(ch.length, 0, "channel should be empty");
  ch.close();
  t.end();
});

test("[casp] put returns Promise", (t) => {
  const ch = chan();
  let p = ch.put("foo");
  t.ok(p instanceof Promise, "put should return a promise");
  ch.close();
  t.end();
});

test("[casp] take returns Promise", (t) => {
  const ch = chan();
  let p = ch.take();
  t.ok(p instanceof Promise, "take should return a promise");
  ch.close();
  t.end();
});

test("[casp] put", async (t) => {
  const ch = chan();
  const p = ch.take();
  const rp1 = await ch.put("foo");
  t.equals(await p, "foo", "should return 'foo'");
  t.equals(rp1, "foo", "should return 'foo'");
  const p2 = take(ch);
  const rp2 = await put(ch, "bar");
  t.equals(await p2, "bar", "pointfree puts 'bar'");
  t.equals(rp2, "bar", "should return 'bar'");
  ch.close();
  t.end();
});

test("[casp] take", async (t) => {
  const ch = chan();
  ch.put("foo");
  t.equals(await ch.take(), "foo", "should return 'foo'");
  ch.put("bar");
  t.equals(await take(ch), "bar", "pointfree take returns 'bar'");
  ch.close();
  t.end();
});

test("[casp] put / take", async (t) => {
  const ch = chan();
  setTimeout(async () => await ch.put("foo"), 5);
  const res = await ch.take();
  t.equals(res, "foo", "take should return value passed to put");
  ch.close();
  t.end();
});

test("[casp] sput", async (t) => {
  const ch = chan();
  const p = ch.take();
  const sp = ch.sput("foo");
  t.ok(sp, "sput should return true");
  const res = await p;
  t.equals(res, "foo", "take should return sput's value");
  const p2 = take(ch);
  const sp2 = sput(ch, "bar");
  t.ok(sp2, "sput should return true");
  const res2 = await p2;
  t.equals(res2, "bar", "pointfree sput's value");
  ch.close();
  t.end();
});

test("[casp] stake", (t) => {
  const ch = chan();
  ch.put("foo");
  const st = ch.stake();
  t.equals(st, "foo", "should return put's value");
  t.equals(ch.length, 0, "ch should be empty");
  put(ch, "bar");
  const st2 = stake(ch);
  t.equals(st2, "bar", "pointfree stake value");
  ch.close();
  t.end();
});

test("[casp] AsyncIterable - channel", async (t) => {
  const ch = chan();
  ch.put("foo");
  ch.put("bar");
  ch.put("baz");
  let i = 1;
  for await (const m of ch) {
    if (i === 1) t.equals(m, "foo", "should return put's value [1]");
    if (i === 2) t.equals(m, "bar", "should return put's value [2]");
    if (i === 3) {
      t.equals(m, "baz", "should return put's value [3]");
      break;
    }
    ++i;
  }
  ch.close();
  t.end();
});

test("[casp] race", async (t) => {
  const ch = chan();
  const p = ch.race();
  t.ok(p instanceof Promise, "race should return a promise");
  ch.put("foo");
  const [resCh, val] = await p;
  t.equals(resCh, ch, "should return channel in first place");
  t.equals(val, "foo", "should return value in second place");
  ch.close();
  t.end();
});

test("[casp] alts", async (t) => {
  const ch1 = chan();
  const ch2 = chan();
  const p = alts(ch1, ch2);
  t.ok(p instanceof Promise, "alts should return a promise");
  ch1.put("foo");
  const [resCh, val] = await p;
  t.equals(resCh, ch1, "should return first channel in first slot");
  t.equals(val, "foo", "should return value in second slot");
  ch1.close();
  ch2.close();
  t.end();
});

test("[casp] AsyncIterable - alts", async (t) => {
  const ch1 = chan();
  const ch2 = chan();
  ch1.put("foo");
  setTimeout(() => ch2.put("bar"), 10);
  let count = 1;
  for await (const [resCh, val] of alts(ch1, ch2)) {
    if (count === 1) {
      t.equals(resCh.id, ch1.id, "first slot should be ch1");
      t.equals(val, "foo", "val equals 'foo'");
      count++;
    } else {
      t.equals(resCh.id, ch2.id, "first slot should be ch2");
      t.equals(val, "bar", "val equals 'bar'");
      break;
    }
  }
  ch1.close();
  ch2.close();
  t.end();
});

test("[casp] pipe", async (t) => {
  const input = chan();
  const output = chan();
  input.pipe(output);
  input.put("foo");
  t.equals(await take(output), "foo", "should return what was put in input");
  input.close();
  t.ok(output.isClosed(), "output should close with input");
  t.end();
});

test("[casp] pipe pointfree", async (t) => {
  const input = chan();
  const output = chan();
  pipe(input, output, { keepOpen: true });
  input.put("foo");
  t.equals(await take(output), "foo", "should return what was put in input");
  input.close();
  t.notOk(output.isClosed(), "output should close with input");
  output.close();
  t.end();
});

test("[casp] demux", async (t) => {
  const in1 = chan();
  const in2 = chan();
  const in3 = chan();
  const output = chan();
  output.demux([in1, in2, in3]);
  in1.put("foo");
  in2.put("bar");
  in3.put("baz");
  t.equals(await take(output), "foo", "should return from in1");
  t.equals(await take(output), "bar", "should return from in2");
  t.equals(await take(output), "baz", "should return from in3");
  in1.close();
  in2.close();
  in3.close();
  output.close();
  t.end();
});

test("[casp] demux pointfree", async (t) => {
  const in1 = chan();
  const in2 = chan();
  const output = chan();
  demux(output, [in1, in2]);
  in1.put("foo");
  t.equals(await take(output), "foo", "should return from in1");
  in1.close();
  in2.close();
  output.close();
  t.end();
});

test("[casp] mux", async (t) => {
  const out1 = chan();
  const out2 = chan();
  const out3 = chan();
  const input = chan();
  input.mux([out1, out2, out3]);
  input.put("foo");
  t.equals(await take(out1), "foo", "should return same as other outputs");
  t.equals(await take(out2), "foo", "should return same as other outputs");
  t.equals(await take(out3), "foo", "should return same as other outputs");
  input.close();
  t.end();
});

test("[casp] mux pointfree", async (t) => {
  const out1 = chan();
  const out2 = chan();
  const input = chan();
  mux(input, [out1, out2]);
  input.put("foo");
  t.equals(await take(out1), "foo", "should return same as other outputs");
  t.equals(await take(out2), "foo", "should return same as other outputs");
  input.close();
  t.end();
});
