# Bounded critical Agent boundary review

The latest user limits gate overhead to critical changes and at most 3% of total time / 4% of tokens. The controller planned a 162-second total gate allowance for the initial 90-minute execution estimate, targeting one <=120-second focused review, concise tool reads/output and no test/build/internet gate work. Noncritical UI tickets used implementation self-review and meaningful functional verification, without independent approval gates.

Reviewer /root/critical_bridge_review inspected only native invocation, process ownership, run gateway/mutation journal, project/plan scoping and scoped MCP. It reported no Critical and one Important: Windows taskkill /T depends on a still-live CLI root PID, so root-first exit can leak descendants/stdio and hang cleanup.

Controller inspected the concrete functions and confirmed this finding. Correction b091523 refuses native Windows Chat before probing/spawning, retains POSIX owned process groups and clearly preserves ordinary HTTP/UI/MCP Windows support. A meaningful refusal-before-spawn test showed RED/GREEN; related18 tests and affected package checks passed. Reliable native Windows owned jobs are tracked in AG-03. No second independent gate/re-review was added.

Other inspected critical boundaries: native execution tools restricted, trusted empty run cwd, fixed MCP project binding and plan ownership, no approval/open-project forwarding, committed mutation recorded before response, gateway drains in-flight requests. Actual native model and OS behavior are not proved by this static review; evidence comes from separately labeled functional tests. Review was bounded to these code paths; it was not a full UI/branch review. No checksums or file-integrity gate was required.

AG-04 later replaces universal account-login detection with existing Provider/Profile API auth reuse; per-process model/provider metadata extraction leaves the reviewed native/MCP tool restrictions intact. Meaningful profile tests and actual native Agent smoke cover this new behavior; no repeated independent gate.
