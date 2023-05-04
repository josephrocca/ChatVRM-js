import { saturate } from './saturate.js';

export const linearstep = (a, b, t) => (
  saturate((t - a) / (b - a))
);
