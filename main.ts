// aJ Chat - Enhanced Two User Chat App
// Server with Deno KV for persistence

// @ts-types deno types
declare const Deno: {
  openKv(): Promise<Kv>;
  readFile(path: string): Promise<Uint8Array>;
  upgradeWebSocket(req: Request): { socket: WebSocket; response: Response };
  serve(options: { port: number }, handler: (req: Request) => Promise<Response> | Response): void;
};

interface Kv {
  get<T>(key: string[]): Promise<{ value: T | null }>;
  set(key: string[], value: unknown): Promise<void>;
  delete(key: string[]): Promise<void>;
  list<T>(options: { prefix: string[] }): AsyncIterable<{ key: string[]; value: T }>;
}

// Initialize Deno KV for message persistence
const kv = await Deno.openKv();

// Store connected clients
const clients = new Map<WebSocket, { user: string | null; mood?: string }>();

// Message interface - includes all possible message properties
interface Message {
  type: string;
  id?: string;
  user?: string;
  text?: string;
  time?: number;
  media?: { type: string; name: string; data: string };
  read?: boolean;
  reactions?: Record<string, string[]>;
  typing?: boolean;
  emoji?: string;
  content?: string;
  mood?: string;
  online?: boolean;
  messages?: Message[];
}

export {};

// Broadcast message to all connected clients
function broadcast(obj: Message) {
  const msg = JSON.stringify(obj);
  for (const [ws] of clients) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    } catch (_) {
      /* ignore */
    }
  }
}

// Broadcast to a specific user
function broadcastToUser(user: string, obj: Message) {
  const msg = JSON.stringify(obj);
  for (const [ws, info] of clients) {
    if (info.user === user && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(msg);
      } catch (_) {
        /* ignore */
      }
    }
  }
}

// Save message to KV store
async function saveMessage(msg: Message) {
  const key = ["messages", msg.time || Date.now()];
  await kv.set(key, msg);
}

// Get message history
async function getMessageHistory(): Promise<Message[]> {
  const messages: Message[] = [];
  const iter = kv.list<Message>({ prefix: ["messages"] });
  for await (const entry of iter) {
    messages.push(entry.value);
  }
  // Sort by time and limit to last 100 messages
  return messages.sort((a, b) => (a.time || 0) - (b.time || 0)).slice(-100);
}

// Clear all messages
async function clearMessages() {
  const iter = kv.list({ prefix: ["messages"] });
  for await (const entry of iter) {
    await kv.delete(entry.key);
  }
}

// Delete a specific message
async function deleteMessage(id: string) {
  const iter = kv.list<Message>({ prefix: ["messages"] });
  for await (const entry of iter) {
    if (entry.value.id === id) {
      await kv.delete(entry.key);
      break;
    }
  }
}

// Get shared notes
async function getNotes(): Promise<string> {
  const result = await kv.get<string>(["notes"]);
  return result.value || "";
}

// Save shared notes
async function saveNotes(content: string) {
  await kv.set(["notes"], content);
}

// Get content type for file extension
function getContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
  };
  return types[ext || ""] || "application/octet-stream";
}

// Serve static files
async function serveStatic(pathname: string): Promise<Response> {
  // Default to index.html
  let filePath = pathname === "/" ? "/index.html" : pathname;

  try {
    const file = await Deno.readFile(`./public${filePath}`);
    return new Response(file, {
      headers: {
        "content-type": getContentType(filePath),
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    // If file not found, serve index.html for SPA routing
    try {
      const file = await Deno.readFile("./public/index.html");
      return new Response(file, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }
}

// Handle WebSocket messages
async function handleWebSocketMessage(
  socket: WebSocket,
  data: Message
) {
  const info = clients.get(socket);

  switch (data.type) {
    case "hello":
      if (data.user === "J" || data.user === "a") {
        clients.set(socket, { user: data.user, mood: undefined });

        // Send message history
        const history = await getMessageHistory();
        socket.send(JSON.stringify({ type: "history", messages: history }));

        // Notify others about presence
        broadcast({
          type: "presence",
          user: data.user,
          online: true,
        } as Message);
      }
      break;

    case "chat":
      if (!info?.user) return;

      const msg: Message = {
        type: "chat",
        id: data.id || `${info.user}-${Date.now()}`,
        user: info.user,
        text: data.text ? String(data.text).slice(0, 5000) : undefined,
        media: data.media,
        time: typeof data.time === "number" ? data.time : Date.now(),
        read: false,
      };

      await saveMessage(msg);
      broadcast(msg);
      break;

    case "typing":
      if (!info?.user) return;
      // Broadcast typing status to other user
      const other = info.user === "J" ? "a" : "J";
      broadcastToUser(other, {
        type: "typing",
        user: info.user,
        typing: data.typing,
      } as unknown as Message);
      break;

    case "read":
      if (!info?.user) return;
      // Notify sender that messages were read
      const sender = info.user === "J" ? "a" : "J";
      broadcastToUser(sender, {
        type: "read",
        user: info.user,
      } as Message);
      break;

    case "reaction":
      if (!info?.user || !data.id) return;
      broadcast({
        type: "reaction",
        id: data.id,
        user: info.user,
        emoji: data.emoji,
      } as unknown as Message);
      break;

    case "delete":
      if (!info?.user || !data.id) return;
      // Only allow deleting own messages
      if (data.id.startsWith(info.user)) {
        await deleteMessage(data.id);
        broadcast({
          type: "delete",
          id: data.id,
        } as Message);
      }
      break;

    case "clear":
      await clearMessages();
      broadcast({ type: "history", messages: [] } as unknown as Message);
      break;

    case "getNotes":
      const notes = await getNotes();
      socket.send(JSON.stringify({ type: "notes", content: notes }));
      break;

    case "notes":
      if (data.content !== undefined) {
        await saveNotes(String(data.content).slice(0, 50000));
        // Broadcast to other user
        for (const [ws, wsInfo] of clients) {
          if (ws !== socket && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "notes", content: data.content }));
          }
        }
      }
      break;

    case "mood":
      if (!info?.user) return;
      info.mood = data.mood as string;
      clients.set(socket, info);

      // Broadcast mood to other user
      const otherUser = info.user === "J" ? "a" : "J";
      broadcastToUser(otherUser, {
        type: "presence",
        user: info.user,
        online: true,
        mood: info.mood,
      } as unknown as Message);
      break;
  }
}

// Main server
Deno.serve({ port: 8000 }, async (req) => {
  const { pathname } = new URL(req.url);

  // WebSocket endpoint
  if (pathname === "/ws") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      clients.set(socket, { user: null });
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await handleWebSocketMessage(socket, data);
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    };

    socket.onclose = () => {
      const info = clients.get(socket);
      if (info?.user) {
        broadcast({
          type: "presence",
          user: info.user,
          online: false,
        } as Message);
      }
      clients.delete(socket);
    };

    socket.onerror = () => {
      clients.delete(socket);
    };

    return response;
  }

  // Serve static files
  return await serveStatic(pathname);
});
