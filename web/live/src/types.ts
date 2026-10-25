// The few Cloudflare Workers and Durable Objects types this worker uses, written out so it
// needs no extra package. They follow the runtime's own names.

export interface DurableObjectId { toString(): string }
export interface DurableObjectStub { fetch(input: Request | string, init?: RequestInit): Promise<Response> }
export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

export interface DurableObjectState {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  setWebSocketAutoResponse?(pair: unknown): void;
  storage: { setAlarm(at: number): Promise<void>; deleteAlarm(): Promise<void> };
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

/** A WebSocket as Workers give it: also has attachments that survive hibernation. */
export interface WorkerSocket extends WebSocket {
  accept(): void;
  serializeAttachment(v: unknown): void;
  deserializeAttachment(): unknown;
}

export interface WebSocketPairCtor { new (): { 0: WorkerSocket; 1: WorkerSocket } }

export interface Env {
  LIVE: DurableObjectNamespace;
  /** Optional: a licensed vendor (DEC-0049). Unset means only the free sources run. */
  VENDOR?: string;
  VENDOR_KEY?: string;
}
