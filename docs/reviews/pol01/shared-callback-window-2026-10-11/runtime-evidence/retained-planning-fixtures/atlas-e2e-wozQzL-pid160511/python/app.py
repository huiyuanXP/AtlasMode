from pathlib import Path
Path("/tmp/atlas-e2e-wozQzL/TARGET_EXECUTED").write_text("executed")
raise RuntimeError("Target source must never execute")
def helper():
    return 7
def entry():
    return helper()
def dynamic(fn):
    return fn()
