"use strict";

function acopy(src, srcStart, dest, destStart, len) {
  for (let count = 0; count < len; count += 1) {
    dest[destStart + count] = src[srcStart + count];
  }
}

class RingBuffer {
  constructor(write, read, length, arr) {
    this.write = write;
    this.read = read;
    this.length = length;
    this.arr = arr;
  }

  remove() {
    if (this.length !== 0) {
      const elem = this.arr[this.read];
      this.arr[this.read] = undefined;
      this.read = (this.read + 1) % this.arr.length;
      this.length -= 1;
      return elem;
    }

    return undefined;
  }

  add(element) {
    this.arr[this.write] = element;
    this.write = (this.write + 1) % this.arr.length;
    this.length += 1;
  }

  unboundedAdd(element) {
    if (this.length + 1 === this.arr.length) {
      this.resize();
    }

    this.add(element);
  }

  resize() {
    const newArrSize = this.arr.length * 2;
    const newArr = new Array(newArrSize);

    if (this.read < this.write) {
      acopy(this.arr, this.read, newArr, 0, this.length);
      this.read = 0;
      this.write = this.length;
      this.arr = newArr;
    } else if (this.read > this.write) {
      acopy(this.arr, this.read, newArr, 0, this.arr.length - this.read);
      acopy(this.arr, 0, newArr, this.arr.length - this.read, this.write);
      this.read = 0;
      this.write = this.length;
      this.arr = newArr;
    } else if (this.read === this.write) {
      this.read = 0;
      this.write = 0;
      this.arr = newArr;
    }
  }

  cleanup(predicate) {
    for (let i = this.length; i > 0; i -= 1) {
      const value = this.remove();

      if (predicate(value)) {
        this.add(value);
      }
    }
  }

}

function ring(n) {
  if (n <= 0) {
    throw new Error("Can't create a ring buffer of size 0");
  }

  return new RingBuffer(0, 0, 0, new Array(n));
}

class FixedBuffer {
  constructor(buffer, n) {
    this.buffer = buffer;
    this.n = n;
  }

  isFull() {
    return this.buffer.length === this.n;
  }

  remove() {
    return this.buffer.remove();
  }

  add(item) {
    this.buffer.unboundedAdd(item);
  }

  closeBuffer() {}

  count() {
    return this.buffer.length;
  }

}

function fixed(n) {
  return new FixedBuffer(ring(n), n);
}

class DroppingBuffer {
  constructor(buffer, n) {
    this.buffer = buffer;
    this.n = n;
  }

  isFull() {
    return false;
  }

  remove() {
    return this.buffer.remove();
  }

  add(item) {
    if (this.buffer.length !== this.n) {
      this.buffer.add(item);
    }
  }

  closeBuffer() {}

  count() {
    return this.buffer.length;
  }

}

function dropping(n) {
  return new DroppingBuffer(ring(n), n);
}

class SlidingBuffer {
  constructor(buffer, n) {
    this.buffer = buffer;
    this.n = n;
  }

  isFull() {
    return false;
  }

  remove() {
    return this.buffer.remove();
  }

  add(item) {
    if (this.buffer.length === this.n) {
      this.add();
    }

    this.buffer.add(item);
  }

  closeBuffer() {}

  count() {
    return this.buffer.length;
  }

}

function sliding(n) {
  return new SlidingBuffer(ring(n), n);
}

module.exports = {
  ring,
  fixed,
  dropping,
  sliding
};