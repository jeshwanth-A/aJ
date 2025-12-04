// aJ Chat - Enhanced Two User Chat App
// Server with Deno KV for persistence

// Initialize Deno KV for message persistence
let kv: Deno.Kv;
try {
  kv = await Deno.openKv();
} catch (e) {
  console.error("Failed to initialize Deno KV:", e);
}

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
  // Extended properties for new features
  event?: CalendarEvent;
  eventId?: string;
  item?: WishlistItem;
  itemId?: string;
  countdown?: CountdownItem;
  countdownId?: string;
}

// Calendar Event interface
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  description?: string;
  createdBy: string;
  createdAt: number;
}

// Wishlist Item interface
interface WishlistItem {
  id: string;
  title: string;
  description?: string;
  link?: string;
  addedBy: string;
  completed: boolean;
  createdAt: number;
}

// Countdown Item interface
interface CountdownItem {
  id: string;
  title: string;
  targetDate: string;
  emoji?: string;
  createdBy: string;
  createdAt: number;
}

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

// Add reaction to a message
async function addReactionToMessage(messageId: string, user: string, emoji: string) {
  const iter = kv.list<Message>({ prefix: ["messages"] });
  for await (const entry of iter) {
    if (entry.value.id === messageId) {
      const msg = entry.value;
      if (!msg.reactions) {
        msg.reactions = {};
      }
      if (!msg.reactions[emoji]) {
        msg.reactions[emoji] = [];
      }
      if (!msg.reactions[emoji].includes(user)) {
        msg.reactions[emoji].push(user);
      }
      await kv.set(entry.key, msg);
      break;
    }
  }
}

// Calendar Event functions
async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  const iter = kv.list<CalendarEvent>({ prefix: ["calendar"] });
  for await (const entry of iter) {
    events.push(entry.value);
  }
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function saveCalendarEvent(event: CalendarEvent) {
  await kv.set(["calendar", event.id], event);
}

async function deleteCalendarEvent(eventId: string) {
  await kv.delete(["calendar", eventId]);
}

// Wishlist functions
async function getWishlist(): Promise<WishlistItem[]> {
  const items: WishlistItem[] = [];
  const iter = kv.list<WishlistItem>({ prefix: ["wishlist"] });
  for await (const entry of iter) {
    items.push(entry.value);
  }
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

async function saveWishlistItem(item: WishlistItem) {
  await kv.set(["wishlist", item.id], item);
}

async function deleteWishlistItem(itemId: string) {
  await kv.delete(["wishlist", itemId]);
}

// Countdown functions
async function getCountdowns(): Promise<CountdownItem[]> {
  const countdowns: CountdownItem[] = [];
  const iter = kv.list<CountdownItem>({ prefix: ["countdowns"] });
  for await (const entry of iter) {
    countdowns.push(entry.value);
  }
  return countdowns.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
}

async function saveCountdown(countdown: CountdownItem) {
  await kv.set(["countdowns", countdown.id], countdown);
}

async function deleteCountdown(countdownId: string) {
  await kv.delete(["countdowns", countdownId]);
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
      // Save reaction to message in KV
      await addReactionToMessage(data.id, info.user, data.emoji as string);
      broadcast({
        type: "reaction",
        id: data.id,
        user: info.user,
        emoji: data.emoji,
      } as unknown as Message);
      break;

    case "getCalendar":
      const events = await getCalendarEvents();
      socket.send(JSON.stringify({ type: "calendar", events }));
      break;

    case "saveCalendarEvent":
      if (data.event) {
        await saveCalendarEvent(data.event as CalendarEvent);
        broadcast({ type: "calendar", events: await getCalendarEvents() } as unknown as Message);
      }
      break;

    case "deleteCalendarEvent":
      if (data.eventId) {
        await deleteCalendarEvent(data.eventId as string);
        broadcast({ type: "calendar", events: await getCalendarEvents() } as unknown as Message);
      }
      break;

    case "getWishlist":
      const wishlist = await getWishlist();
      socket.send(JSON.stringify({ type: "wishlist", items: wishlist }));
      break;

    case "saveWishlistItem":
      if (data.item) {
        await saveWishlistItem(data.item as WishlistItem);
        broadcast({ type: "wishlist", items: await getWishlist() } as unknown as Message);
      }
      break;

    case "deleteWishlistItem":
      if (data.itemId) {
        await deleteWishlistItem(data.itemId as string);
        broadcast({ type: "wishlist", items: await getWishlist() } as unknown as Message);
      }
      break;

    case "getCountdowns":
      const countdowns = await getCountdowns();
      socket.send(JSON.stringify({ type: "countdowns", countdowns }));
      break;

    case "saveCountdown":
      if (data.countdown) {
        await saveCountdown(data.countdown as CountdownItem);
        broadcast({ type: "countdowns", countdowns: await getCountdowns() } as unknown as Message);
      }
      break;

    case "deleteCountdown":
      if (data.countdownId) {
        await deleteCountdown(data.countdownId as string);
        broadcast({ type: "countdowns", countdowns: await getCountdowns() } as unknown as Message);
      }
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
Deno.serve(async (req) => {
  const { pathname } = new URL(req.url);

  // Check for KV initialization
  if (!kv) {
    return new Response("Service Temporarily Unavailable: Database not initialized", { status: 503 });
  }

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
