import { writeFileSync } from "node:fs";
writeFileSync("/tmp/atlas-e2e-wozQzL/TARGET_EXECUTED", "executed");
throw new Error("Target source must never execute");
