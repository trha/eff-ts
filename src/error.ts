import * as Either from "fp-ts/Either";
import { Effect, handle, interpose, interpret, interpretWithCont } from "./effect";

export {
  Err,
  throwErr,
  runErr,
  runErrThrowing,
  catchErr,
  recoverErr,
  mapErr,
  liftEither,
};

class Err {
  constructor(public thrownErr: unknown) {}
}

function* throwErr<E, T>(err: E): Effect<Err, T> {
  return yield new Err(err);
}

function runErr<Effs, T>(
  eff: Effect<Effs | Err, T>,
): Effect<Exclude<Effs, Err>, Either.Either<unknown, T>> {
  return handle(
    Err,
    function* (ret) { return Either.right(ret); },
  function* ({ thrownErr }) { return Either.left(thrownErr); },
  eff,
  );
}

function runErrThrowing<Effs, T>(
  eff: Effect<Effs | Err, T>,
): Effect<Exclude<Effs, Err>, T> {
  return interpret(
    Err,
    ({ thrownErr }) => {
      throw thrownErr;
    },
    eff
  );
}

function catchErr<Effs, T>(
  eff: Effect<Effs | Err, T>,
  handle: (err: unknown) => Effect<Effs | Err, T>,
): Effect<Effs | Err, T> {
  return interpose(
    Err,
    function* (r) { return r; },
    ({ thrownErr }) => handle(thrownErr),
    eff
  );
}

function mapErr<Effs, T>(
  eff: Effect<Effs | Err, T>,
  map: (err: unknown) => unknown,
): Effect<Effs | Err, T> {
  return interpose(
    Err,
    function* (r) { return r; },
    ({ thrownErr }) => throwErr(map(thrownErr)),
    eff
  );
}


function recoverErr<Effs, T>(
  eff: Effect<Effs | Err, T>,
  recover: (err: unknown) => T,
): Effect<Exclude<Effs, Err>, T> {
  return interpretWithCont(
    Err,
    function* ({ thrownErr }) { return recover(thrownErr); },
    eff,
  );
}

function* liftEither<E, T>(either: Either.Either<E, T>): Effect<Err, T> {
  switch (either._tag) {
    case "Left":
      return yield* throwErr(either.left);
    case "Right":
      return either.right;
  }
}
