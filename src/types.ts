export { Constructor };
type Constructor<T> = new (...args: any[]) => T;
