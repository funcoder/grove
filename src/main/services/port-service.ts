import net from "node:net";

export class PortService {
  private readonly allocated = new Map<string, number>();
  private nextPort = 3000;

  async allocate(worktreeId: string): Promise<number> {
    const existing = this.allocated.get(worktreeId);
    if (existing) return existing;

    for (let port = this.nextPort; port < this.nextPort + 100; port++) {
      const available = await this.isAvailable(port);
      if (available) {
        this.allocated.set(worktreeId, port);
        this.nextPort = port + 1;
        return port;
      }
    }

    throw new Error("No available ports");
  }

  release(worktreeId: string): void {
    this.allocated.delete(worktreeId);
  }

  private isAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, "127.0.0.1");
    });
  }
}
