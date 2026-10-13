import { writeFileSync } from "node:fs";
export function owned() { return 1; }
writeFileSync("/tmp/atlas-pol01-acceptance-g3rA7o/TARGET_EXECUTED", "executed");
throw new Error("Target source must never execute");
