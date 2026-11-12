const crypto = require("crypto");

function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(pw, salt, 100000, 64, "sha512");
  return ["pbkdf2", "sha512", "100000", salt.toString("hex"), derived.toString("hex")].join("$");
}

function verify(pw, stored) {
  const parts = stored.split("$");
  const iterations = parseInt(parts[2], 10);
  const salt = Buffer.from(parts[3], "hex");
  const expected = parts[4];
  const derived = crypto.pbkdf2Sync(pw, salt, iterations, 64, "sha512").toString("hex");
  return derived === expected;
}

const hDemo = hashPw("demo");
const h1234 = hashPw("1234");
console.log("demo valid:", verify("demo", hDemo));
console.log("1234 valid:", verify("1234", h1234));
console.log("hDemo:", hDemo);
console.log("h1234:", h1234);
