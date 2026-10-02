/** Owns UI selection identity, independently of project IDs (A → B → A is new). */
export class ProjectScope {
  private epoch = 0;
  private projectId = "";
  private requests = new Map<string, number>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  select(id: string) {
    this.epoch++;
    this.projectId = id;
    this.requests.clear();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
  invalidate(key: string) {
    this.requests.set(key, (this.requests.get(key) ?? 0) + 1);
  }
  async run<T>(
    key: string,
    task: () => Promise<T>,
    commit: (value: T) => void,
    reject?: (error: unknown) => void,
  ) {
    const epoch = this.epoch;
    const sequence = (this.requests.get(key) ?? 0) + 1;
    this.requests.set(key, sequence);
    const current = () =>
      epoch === this.epoch && sequence === this.requests.get(key);
    try {
      const value = await task();
      if (current()) commit(value);
    } catch (error) {
      if (current()) {
        if (reject) reject(error);
        else throw error;
      }
    }
  }
  schedule(key: string, write: (projectId: string) => void, delay: number) {
    clearTimeout(this.timers.get(key));
    const id = this.projectId,
      epoch = this.epoch;
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        if (epoch === this.epoch && id) write(id);
      }, delay),
    );
  }
}
