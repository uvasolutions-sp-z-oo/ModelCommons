export class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    let unlock!: () => void;
    const current = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const previous = this.tail;
    this.tail = previous.then(() => current, () => current);
    await previous;
    try {
      return await work();
    } finally {
      unlock();
    }
  }
}

export class AsyncEventQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = [];
  private readonly waiters: Array<(result: IteratorResult<T>) => void> = [];
  private closed = false;

  constructor(private readonly onIteratorReturn?: () => void) {}

  push(value: T): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value, done: false });
    } else {
      this.values.push(value);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) {
      waiter({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.values.length > 0) {
          return Promise.resolve({ value: this.values.shift()!, done: false });
        }
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise<IteratorResult<T>>((resolve) => this.waiters.push(resolve));
      },
      return: () => {
        this.onIteratorReturn?.();
        this.values.length = 0;
        this.close();
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}
