import { Effect, interpose, interpret } from "./effect";
import { Constructor } from "./types";

export { Reader, ask, runReader, local };

const readerConstructors: Map<Constructor<any>, Constructor<Reader<any>>> = new Map();

function readerConstructorFor<T>(c: Constructor<T>): Constructor<Reader<T>> {
  const instance = readerConstructors.get(c);
  if (instance) {
    return instance;
  }
  class ReaderT extends Reader<T> { }
  readerConstructors.set(c, ReaderT);
  return ReaderT;
}

class Reader<Env> {
  constructor(contra?: Env) {
    // Empty.
  }
}

function* ask<Env, Effs>(envType: Constructor<Env>): Effect<Effs | Reader<Env>, Env> {
  return yield new (readerConstructorFor(envType));
}

function runReader<Env, Effs, T>(
  envType: Constructor<Env>,
  env: Env,
  eff: Effect<Effs | Reader<Env>, T>,
): Effect<Exclude<Effs, Reader<Env>>, T> {
  return interpret(
    readerConstructorFor(envType),
    function* () { return env; },
    eff,
  );
}

function local<Env, T, Effs>(
  modify: (env: Env) => Env,
  envType: Constructor<Env>,
  eff: Effect<Effs | Reader<Env>, T>,
): Effect<Effs | Reader<Env>, T> {
  return interpose(
    readerConstructorFor(envType),
    function* (r) { return r; },
    function* (_, resume) { return yield* resume(modify(yield* ask(envType))); },
    eff,
  );
}
