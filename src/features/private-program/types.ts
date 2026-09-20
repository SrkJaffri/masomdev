/** Result shape returned by the public Private Program server action. */
export type PrivateProgramActionResult =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      /**
       * Field-level messages keyed by schema field, so the client can highlight
       * the offending inputs when the server rejects a payload the browser
       * thought was fine.
       */
      fieldErrors?: Record<string, string>;
    };

export const idlePrivateProgramResult: PrivateProgramActionResult = { status: "idle" };
