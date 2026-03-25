/** Typed HTTP error factory functions — replaces scattered Object.assign(new Error(), { status }) calls */

export const badRequest = (msg: string) =>
  Object.assign(new Error(msg), { status: 400 });

export const unauthorized = (msg = 'Unauthorized') =>
  Object.assign(new Error(msg), { status: 401 });

export const notFound = (msg = 'Not found') =>
  Object.assign(new Error(msg), { status: 404 });

export const gone = (msg: string) =>
  Object.assign(new Error(msg), { status: 410 });

export const preconditionRequired = (msg: string) =>
  Object.assign(new Error(msg), { status: 428 });
