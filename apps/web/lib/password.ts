import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (password: string) => hash(password, ARGON2_OPTS);

export const verifyPassword = (password: string, passwordHash: string) =>
  verify(passwordHash, password);
