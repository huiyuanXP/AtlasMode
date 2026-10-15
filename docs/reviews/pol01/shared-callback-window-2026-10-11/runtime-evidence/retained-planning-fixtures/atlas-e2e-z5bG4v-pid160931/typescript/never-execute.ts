import { writeFileSync } from "node:fs";
writeFileSync("/tmp/atlas-e2e-z5bG4v/TARGET_EXECUTED", "executed");
throw new Error("Target source must never execute");
