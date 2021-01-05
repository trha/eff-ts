import { decompose, Effect } from "./effect";
import { Err, throwErr } from "./error";
import * as Either from "fp-ts/Either";

export { Async, wait, waitThrowing, runAsync, race, all };

class Async {
  constructor(public awaitedPromise: Promise<any>) {}
}

function* wait<T>(promise: Promise<T>): Effect<Async | Err, T> {
  promise.catch(() => {
    // This is required to silent `PromiseRejectionHandledWarning`. We defer handling of promises to `runAsync`.
  });
  const result: Either.Either<unknown, T> = yield new Async(promise);
  switch (result._tag) {
    case "Left":
      return yield* throwErr(result.left);
    case "Right":
      return result.right;
  }
}

function* waitThrowing<T>(promise: Promise<T>): Effect<Async, T> {
  const result: Either.Either<unknown, T> = yield new Async(promise);
  switch (result._tag) {
    case "Left":
      throw result.left;
    case "Right":
      return result.right;
  }
}

async function runAsync<T>(eff: Effect<Async, T>): Promise<T> {
  for (let req = eff.next(); ; ) {
    if (req.done === true) {
      return req.value;
    }

    try {
      req = eff.next(Either.right(await req.value.awaitedPromise));
    } catch (err) {
      req = eff.next(Either.left(err));
    }
  }
}

// TODO: Clean up the implementation below.

function* race<T1, T2, Effs>(
  first: Effect<Async | Effs, T1>,
  second: Effect<Async | Effs, T2>
): Effect<Async | Effs, Either.Either<T1, T2>> {
  type GenState =
    | { tag: "Pending" }
    | { tag: "Blocking"; promise: Promise<any> };
  let firstState: GenState = { tag: "Pending" };
  let secondState: GenState = { tag: "Pending" };

  let firstReq = first.next();
  let secondReq = second.next();

  for (;;) {
    if (firstState.tag === "Pending") {
      if (firstReq.done === true) {
        return Either.left<T1, T2>(firstReq.value);
      }

      const firstDecomposed = decompose(firstReq.value, Async);
      switch (firstDecomposed._tag) {
        case "Left":
          firstReq = first.next(yield firstDecomposed.left);
          break;
        case "Right":
          firstState = {
            tag: "Blocking",
            promise: firstDecomposed.right.awaitedPromise,
          };
          break;
      }
    }

    if (secondState.tag === "Pending") {
      if (secondReq.done === true) {
        return Either.right<T1, T2>(secondReq.value);
      }

      const secondDecomposed = decompose(secondReq.value, Async);
      switch (secondDecomposed._tag) {
        case "Left":
          secondReq = second.next(yield secondDecomposed.left);
          break;
        case "Right":
          secondState = {
            tag: "Blocking",
            promise: secondDecomposed.right.awaitedPromise,
          };
          break;
      }
    }

    if (firstState.tag === "Blocking" && secondState.tag === "Blocking") {
      // Can't make further progress.
      const result: Either.Either<
        Either.Either<unknown, unknown>,
        Either.Either<T1, T2>
      > = yield new Async(
        Promise.race([
          firstState.promise.then(Either.left, (err) => {
            throw Either.left(err);
          }),
          secondState.promise.then(Either.right, (err) => {
            throw Either.right(err);
          }),
        ])
      );

      switch (result._tag) {
        case "Left":
          const err = result.left;
          switch (err._tag) {
            case "Left":
              firstState = { tag: "Pending" };
              firstReq = first.next(Either.left(err.left));
              break;
            case "Right":
              secondState = { tag: "Pending" };
              secondReq = second.next(Either.left(err.right));
              break;
          }
          break;
        case "Right":
          const ok = result.right;
          switch (ok._tag) {
            case "Left":
              firstState = { tag: "Pending" };
              firstReq = first.next(Either.right(ok.left));
              break;
            case "Right":
              secondState = { tag: "Pending" };
              secondReq = second.next(Either.right(ok.right));
              break;
          }
          break;
      }
    }
  }
}

function* all<T1, T2, Eff>(
  first: Effect<Async | Eff, T1>,
  second: Effect<Async | Eff, T2>
): Effect<Async | Eff, [T1, T2]> {
  type GenState<R> =
    | { tag: "Pending" }
    | { tag: "Blocking"; promise: Promise<any> }
    | { tag: "Done"; result: R };
  let firstState: GenState<T1> = { tag: "Pending" };
  let secondState: GenState<T2> = { tag: "Pending" };

  let firstReq = first.next();
  let secondReq = second.next();

  for (;;) {
    if (firstState.tag === "Done" && secondState.tag === "Done") {
      const result: [T1, T2] = [firstState.result, secondState.result];
      return result;
    }

    switch (firstState.tag) {
      case "Pending":
        if (firstReq.done === true) {
          firstState = { tag: "Done", result: firstReq.value };
        } else {
          const firstDecomposed = decompose(firstReq.value, Async);
          switch (firstDecomposed._tag) {
            case "Left":
              firstReq = first.next(yield firstDecomposed.left);
              break;
            case "Right":
              firstState = {
                tag: "Blocking",
                promise: firstDecomposed.right.awaitedPromise,
              };
              break;
          }
        }
        break;

      case "Blocking":
        if (secondState.tag === "Done") {
          for (firstReq = first.next(yield new Async(firstState.promise)); ; ) {
            if (firstReq.done === true) {
              firstState = { tag: "Done", result: firstReq.value };
              break;
            }
            firstReq = first.next(yield firstReq.value);
          }
        }
        break;
    }

    switch (secondState.tag) {
      case "Pending":
        if (secondReq.done === true) {
          secondState = { tag: "Done", result: secondReq.value };
        } else {
          const secondDecomposed = decompose(secondReq.value, Async);
          switch (secondDecomposed._tag) {
            case "Left":
              secondReq = second.next(yield secondDecomposed.left);
              break;
            case "Right":
              secondState = {
                tag: "Blocking",
                promise: secondDecomposed.right.awaitedPromise,
              };
              break;
          }
        }
        break;

      case "Blocking":
        if (firstState.tag === "Done") {
          for (
            secondReq = second.next(yield new Async(secondState.promise));
            ;

          ) {
            if (secondReq.done === true) {
              secondState = { tag: "Done", result: secondReq.value };
              break;
            }
            secondReq = second.next(yield secondReq.value);
          }
        }
        break;
    }

    if (firstState.tag === "Blocking" && secondState.tag === "Blocking") {
      // Can't make further progress.
      const result: Either.Either<
        Either.Either<unknown, unknown>,
        [T1, T2]
      > = yield new Async(
        Promise.all([
          firstState.promise.catch((err) => {
            throw Either.left(err);
          }),
          secondState.promise.catch((err) => {
            throw Either.right(err);
          }),
        ])
      );

      switch (result._tag) {
        case "Left":
          const err = result.left;
          switch (err._tag) {
            case "Left":
              firstState = { tag: "Pending" };
              firstReq = first.next(Either.left(err.left));
              break;
            case "Right":
              secondState = { tag: "Pending" };
              secondReq = second.next(Either.left(err.right));
              break;
          }
          break;
        case "Right":
          const [okFirst, okSecond] = result.right;
          firstState = secondState = { tag: "Pending" };
          firstReq = first.next(Either.right(okFirst));
          secondReq = second.next(Either.right(okSecond));
          break;
      }
    }
  }
}
