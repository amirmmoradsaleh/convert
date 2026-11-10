/**
 * Polyfills required for PDF engine compatibility across Node 20 / older V8 runtimes.
 * Must be imported before any pdfjs-dist module evaluation to prevent ReferenceErrors
 * and runtime TypeErrors during PDF loading and processing.
 */

export interface PromiseWithResolversResult<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

interface ExtendedPromiseConstructor {
  withResolvers?: <T>() => PromiseWithResolversResult<T>;
  try?: <T, A extends unknown[]>(
    fn: (...args: A) => T | PromiseLike<T>,
    ...args: A
  ) => Promise<T>;
}

const ExtendedPromise = Promise as unknown as ExtendedPromiseConstructor;

// 1. Polyfill Promise.withResolvers (ECMAScript 2024, native in Node 22+, missing in Node 20)
if (typeof ExtendedPromise.withResolvers !== 'function') {
  ExtendedPromise.withResolvers = function <T>(): PromiseWithResolversResult<T> {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 2. Polyfill Promise.try with synchronous exception handling
if (typeof ExtendedPromise.try !== 'function') {
  ExtendedPromise.try = function <T, A extends unknown[]>(
    fn: (...args: A) => T | PromiseLike<T>,
    ...args: A
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        resolve(fn(...args));
      } catch (err: unknown) {
        reject(err);
      }
    });
  };
}

// 3. Polyfill Uint8Array.prototype.toHex if not supported in runtime
interface Uint8ArrayConstructorWithToHex {
  prototype: Uint8Array & {
    toHex?: (this: Uint8Array) => string;
  };
}

const ExtendedUint8Array = Uint8Array as unknown as Uint8ArrayConstructorWithToHex;

if (typeof ExtendedUint8Array.prototype.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function (this: Uint8Array): string {
      return Array.from(this)
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('');
    },
    writable: true,
    configurable: true,
  });
}

// 4. Polyfill Iterator if not supported in runtime (e.g. Node 20 / older V8)
// Standards-compatible prototype binding against %IteratorPrototype% (ECMAScript 2025)
type GlobalScopeWithIterator = typeof globalThis & {
  Iterator?: {
    prototype: object;
    new (): object;
  };
};

const targetGlobal = globalThis as GlobalScopeWithIterator;

if (typeof targetGlobal.Iterator === 'undefined') {
  const IteratorPrototype = Object.getPrototypeOf(
    Object.getPrototypeOf([][Symbol.iterator]())
  ) as object;

  function IteratorConstructor() {}
  IteratorConstructor.prototype = IteratorPrototype;

  targetGlobal.Iterator = IteratorConstructor as unknown as NonNullable<
    GlobalScopeWithIterator['Iterator']
  >;
}

export {};
