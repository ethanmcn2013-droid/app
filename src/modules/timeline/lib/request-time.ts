import { cache } from "react";

/** One stable clock read per React server request. */
export const getRequestTime = cache(() => Date.now());
