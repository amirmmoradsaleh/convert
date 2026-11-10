import { describe, it, expect } from 'vitest';
import '@/engines/pdf/polyfills';

describe('PDF Engine Polyfills Correctness & Safety', () => {
  describe('Promise.withResolvers', () => {
    it('provides { promise, resolve, reject } and resolves correctly', async () => {
      interface CustomResolvers {
        withResolvers?: <T>() => {
          promise: Promise<T>;
          resolve: (val: T) => void;
          reject: (err?: unknown) => void;
        };
      }
      const pConstructor = Promise as unknown as CustomResolvers;
      expect(typeof pConstructor.withResolvers).toBe('function');

      const { promise, resolve } = pConstructor.withResolvers!<string>();
      expect(promise instanceof Promise).toBe(true);

      resolve('resolved-data');
      await expect(promise).resolves.toBe('resolved-data');
    });

    it('rejects correctly when reject is invoked', async () => {
      interface CustomResolvers {
        withResolvers?: <T>() => {
          promise: Promise<T>;
          resolve: (val: T) => void;
          reject: (err?: unknown) => void;
        };
      }
      const pConstructor = Promise as unknown as CustomResolvers;
      const { promise, reject } = pConstructor.withResolvers!<string>();

      reject(new Error('forced rejection'));
      await expect(promise).rejects.toThrow('forced rejection');
    });
  });

  describe('Promise.try', () => {
    interface CustomPromiseTry {
      try?: <T, A extends unknown[]>(
        fn: (...args: A) => T | PromiseLike<T>,
        ...args: A
      ) => Promise<T>;
    }
    const pConstructor = Promise as unknown as CustomPromiseTry;

    it('resolves synchronous return values with arguments', async () => {
      expect(typeof pConstructor.try).toBe('function');

      const resultPromise = pConstructor.try!(
        (a: number, b: number) => a + b,
        15,
        25
      );
      await expect(resultPromise).resolves.toBe(40);
    });

    it('handles asynchronous promise return values', async () => {
      const asyncFn = async (val: string) => `async-${val}`;
      const resultPromise = pConstructor.try!(asyncFn, 'hello');
      await expect(resultPromise).resolves.toBe('async-hello');
    });

    it('catches synchronous exceptions and turns them into promise rejections', async () => {
      const throwingFn = () => {
        throw new Error('synchronous failure inside try');
      };

      const resultPromise = pConstructor.try!(throwingFn);
      await expect(resultPromise).rejects.toThrow('synchronous failure inside try');
    });
  });

  describe('Uint8Array.prototype.toHex', () => {
    it('converts byte array to formatted hex string', () => {
      interface HexUint8Array extends Uint8Array {
        toHex?: () => string;
      }
      const arr = new Uint8Array([0x00, 0x0f, 0x10, 0xab, 0xff]) as HexUint8Array;
      expect(typeof arr.toHex).toBe('function');
      expect(arr.toHex!()).toBe('000f10abff');
    });
  });

  describe('Iterator prototype binding', () => {
    it('defines globalThis.Iterator with prototype inheritance', () => {
      interface GlobalIterator {
        Iterator?: { prototype: { join?: (sep: string) => string } };
      }
      const g = globalThis as GlobalIterator;
      expect(g.Iterator).toBeDefined();
      expect(typeof g.Iterator?.prototype).toBe('object');
    });

    it('supports calling .join on an iterator instance when polyfilled', () => {
      const iterator = ['alpha', 'beta', 'gamma'].values();
      interface JoinableIterator {
        join?(separator?: string): string;
      }
      const joinable = iterator as unknown as JoinableIterator;
      if (typeof joinable.join === 'function') {
        expect(joinable.join('-')).toBe('alpha-beta-gamma');
      }
    });
  });
});
