# CaSP

This is an implementation of Channels for Communicating Sequential Processes, only these are async processes.

## Usage

```js
import { chan, put, take } from "casp";

const ch = chan();

async function ping(id, N, exit) {
  for (let i = 0; i < N; ++i) {
    console.log("pinging", id, i);
    await ch.put({ id, ping: i });
  }
  console.log("done pushing", id);
  if (exit) ch.close();
  console.log("done with", id);
  console.log("ping error", id, e);
}

async function pong() {
  let count = 0;
  while (true) {
    console.log("pong", await chan.take());
    ++count;
  }
}

ping("un", 4);
ping("dos", 5);
ping("tres", 6, true);
pong();
```

## API

### `ch = chan(buffer = ring(32), transform = x => x)`

##### `ch.id`

##### `ch.END`

### `ch.put(value)` **or** `put(ch, value)`

### `ch.sput(value)` **or** `sput(ch, value)`

### `ch.take()` **or** `take(ch)`

### `ch.stake()` **or** `stake(ch)`

### `ch.close()` **or** `close(ch)`

### `ch.isClosed` **or** `isClosed(ch)`

### `alts(...chs)`

### `input.pipe(output, opts)` **or** `pipe(input, output, opts)`

### `output.demux(inputs, keepOpen)` **or** `demux(output, inputs, keepOpen)`

### `input.mux(outputs, keepOpen)` **or** `mux(input, outputs, keepOpen)`
