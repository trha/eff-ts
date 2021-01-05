import * as Either from "fp-ts/Either";
import { Constructor } from "./types";

export {
  Effect,
  decompose,
  runPure,
  handle,
  interpret,
  interpretWithCont,
  interpose,
  introEff1,
  introEff2,
};

type Effect<Effs, T> = Generator<Effs, T, any>;

function decompose<Ls, R>(
  union: Ls | R,
  RightConstructor: Constructor<R>
): Either.Either<Exclude<Ls, R>, R> {
  return union instanceof RightConstructor
    ? Either.right(union as R)
    : Either.left(union as Exclude<Ls, R>);
}

function runPure<T>(eff: Effect<never, T>): T {
  return eff.next().value;
}

function interpret<Effs, Eff, R>(
  reqType: Constructor<Eff>,
  interpreter: (req: Eff) => Effect<Exclude<Effs, Eff>, any>,
  eff: Effect<Effs | Eff, R>
): Effect<Exclude<Effs, Eff>, R> {
  return handle(
    reqType,
    function* (r) {
      return r;
    },
    function* (req, resume) {
      return yield* resume(yield* interpreter(req));
    },
    eff
  );
}

function interpretWithCont<Effs, Eff, R>(
  reqType: Constructor<Eff>,
  interpreter: (
    req: Eff,
    resume: (value: any) => Effect<Exclude<Effs, Eff>, R>
  ) => Effect<Exclude<Effs, Eff>, R>,
  eff: Effect<Effs | Eff, R>
): Effect<Exclude<Effs, Eff>, R> {
  return handle(
    reqType,
    function* (r) {
      return r;
    },
    interpreter,
    eff
  );
}

function handle<Effs, Eff, R1, R2>(
  reqType: Constructor<Eff>,
  handlePure: (ret: R1) => Effect<Exclude<Effs, Eff>, R2>,
  handleReq: (
    req: Eff,
    resume: (value: any) => Effect<Exclude<Effs, Eff>, R2>
  ) => Effect<Exclude<Effs, Eff>, R2>,
  eff: Effect<Effs | Eff, R1>
): Effect<Exclude<Effs, Eff>, R2> {
  let req = eff.next();

  function* loop(): Effect<Exclude<Effs, Eff>, R2> {
    if (req.done === true) {
      return yield* handlePure(req.value);
    }

    const decomposed = decompose(req.value, reqType);
    switch (decomposed._tag) {
      case "Left":
        req = eff.next(yield decomposed.left);
        return yield* loop();
      case "Right":
        return yield* handleReq(decomposed.right, function (value) {
          req = eff.next(value);
          return loop();
        });
    }
  }

  return loop();
}

function interpose<Effs, Eff, R1, R2>(
  reqType: Constructor<Eff>,
  handlePure: (ret: R1) => Effect<Effs | Eff, R2>,
  handleReq: (
    req: Eff,
    resume: (value: any) => Effect<Effs | Eff, R2>
  ) => Effect<Effs | Eff, R2>,
  eff: Effect<Effs | Eff, R1>
): Effect<Effs | Eff, R2> {
  let req = eff.next();

  function* loop(): Effect<Effs | Eff, R2> {
    if (req.done === true) {
      return yield* handlePure(req.value);
    }

    const decomposed = decompose(req.value, reqType);
    switch (decomposed._tag) {
      case "Left":
        req = eff.next(yield decomposed.left);
        return yield* loop();
      case "Right":
        return yield* handleReq(decomposed.right, function (value) {
          req = eff.next(value);
          return loop();
        });
    }
  }

  return loop();
}

function introEff1<Effs, E1, T>(eff: Effect<Effs, T>): Effect<Effs | E1, T> {
  return eff;
}

function introEff2<Effs, E1, E2, T>(
  eff: Effect<Effs, T>
): Effect<Effs | E1 | E2, T> {
  return eff;
}
