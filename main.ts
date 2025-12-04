// aJ Chat - Two user chat app
const page = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>aJ chat</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 1rem; background:#050816; color:#e5e7eb; }
    .app { max-width: 640px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    button { cursor: pointer; }
    .card { background:#0f172a; border-radius: 0.75rem; padding: 1rem; box-shadow: 0 10px 40px rgba(15,23,42,0.7); }
    .login-btns { display:flex; gap:0.75rem; margin-top:0.5rem; }
    .login-btns button { flex:1; padding:0.75rem 1rem; border-radius:999px; border:none; background:#22c55e; color:#020617; font-weight:600; }
    .login-btns button.secondary { background:#38bdf8; }
    .login-info { margin-top:0.75rem; font-size:0.85rem; color:#9ca3af; }
    .chat { display:flex; flex-direction:column; gap:0.75rem; margin-top:1rem; }
    .messages { height:360px; overflow-y:auto; padding:0.75rem; border-radius:0.75rem; background:#020617; border:1px solid #1f2937; scroll-behavior:smooth; }
    .msg { margin-bottom:0.35rem; max-width:80%; padding:0.4rem 0.65rem; border-radius:0.6rem; font-size:0.9rem; word-wrap:break-word; }
    .msg.me { margin-left:auto; background:#22c55e; color:#022c22; border-bottom-right-radius:0.1rem; }
    .msg.them { margin-right:auto; background:#111827; color:#e5e7eb; border-bottom-left-radius:0.1rem; border:1px solid #1f2937; }
    .meta { font-size:0.7rem; opacity:0.7; margin-bottom:0.1rem; }
    form { display:flex; gap:0.5rem; margin-top:0.75rem; }
    input[type=text] { flex:1; padding:0.6rem 0.8rem; border-radius:999px; border:1px solid #374151; background:#020617; color:#e5e7eb; }
    input[type=text]:focus { outline:none; border-color:#22c55e; box-shadow:0 0 0 1px rgba(34,197,94,0.4); }
    .send-btn { padding:0.6rem 1.2rem; border-radius:999px; border:none; background:#22c55e; color:#022c22; font-weight:600; display:flex; align-items:center; gap:0.25rem; }
    .status { margin-top:0.5rem; font-size:0.8rem; color:#9ca3af; display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap; }
    .pill { padding:0.1rem 0.6rem; border-radius:999px; font-size:0.75rem; background:#111827; color:#e5e7eb; border:1px solid #1f2937; }
    .online { color:#4ade80; }
    .bubble { width:8px; height:8px; border-radius:999px; background:#22c55e; display:inline-block; margin-right:0.2rem; }
    a { color:#38bdf8; }
  </style>
</head>
<body>
  <div class="app">
    <h1>aJ two-person chat</h1>
    <div class="card">
      <div id="login">
        <div>Choose who you are for this browser:</div>
        <div class="login-btns">
          <button onclick="setUser('J')">Login as J</button>
          <button class="secondary" onclick="setUser('a')">Login as a</button>
        </div>
        <div class="login-info">
          No passwords, no signup. Only users <strong>J</strong> and <strong>a</strong> are allowed. Open this page in two browsers/devices, pick different users, and start chatting.
        </div>
      </div>

      <div id="chat" style="display:none;" class="chat">
        <div class="status">
          <span>
            <span class="pill"><span class="bubble"></span><span id="meLabel"></span></span>
            <span class="pill">Talking with <span id="themLabel"></span></span>
          </span>
          <span id="connStatus" class="pill">Connecting...</span>
        </div>
        <div id="messages" class="messages"></div>
        <form id="form">
          <input id="input" type="text" autocomplete="off" placeholder="Type a message and hit Enter" />
          <button type="submit" class="send-btn">Send</button>
        </form>
      </div>
    </div>
  </div>

<script>
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  let ws = null;
  let me = null;

  function setUser(id) {
    me = id;
    localStorage.setItem('aj_user', me);
    document.getElementById('login').style.display = 'none';
    document.getElementById('chat').style.display = 'flex';
    document.getElementById('meLabel').textContent = (me === 'J' ? 'You: J' : 'You: a');
    document.getElementById('themLabel').textContent = (me === 'J' ? 'a' : 'J');
    connect();
  }

  function connect() {
    const statusEl = document.getElementById('connStatus');
    statusEl.textContent = 'Connecting...';
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      statusEl.textContent = 'Online';
      statusEl.classList.add('online');
      ws.send(JSON.stringify({ type: 'hello', user: me }));
    };

    ws.onclose = () => {
      statusEl.textContent = 'Disconnected, retrying...';
      statusEl.classList.remove('online');
      setTimeout(connect, 1200);
    };

    ws.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'chat') {
        addMessage(data.user === me ? 'me' : 'them', data.user, data.text, data.time);
      }
    };
  }

  function addMessage(kind, from, text, time) {
    const box = document.getElementById('messages');
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + kind;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = from + ' - ' + new Date(time).toLocaleTimeString();
    const body = document.createElement('div');
    body.textContent = text;
    wrap.appendChild(meta);
    wrap.appendChild(body);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  }

  document.getElementById('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('input');
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    const msg = { type: 'chat', user: me, text, time: Date.now() };
    ws.send(JSON.stringify(msg));
    input.value = '';
  });

  const saved = localStorage.getItem('aj_user');
  if (saved === 'J' || saved === 'a') {
    setUser(saved);
  }
</script>
</body>
</html>`;

const clients = new Map();

function broadcast(obj: { type: string; user: string; text: string; time: number }) {
  const msg = JSON.stringify(obj);
  for (const [ws] of clients) {
    try { ws.send(msg); } catch (_) { /* ignore */ }
  }
}

Deno.serve({ port: 8000 }, (req) => {
  const { pathname } = new URL(req.url);

  if (pathname === "/ws") {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      clients.set(socket, { user: null });
    };

    socket.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.type === "hello" && (data.user === "J" || data.user === "a")) {
        clients.set(socket, { user: data.user });
        return;
      }

      if (data.type === "chat") {
        const info = clients.get(socket);
        if (!info || !info.user || (info.user !== "J" && info.user !== "a")) return;
        const msg = {
          type: "chat",
          user: info.user,
          text: String(data.text ?? ""),
          time: typeof data.time === "number" ? data.time : Date.now(),
        };
        broadcast(msg);
      }
    };

    socket.onclose = () => {
      clients.delete(socket);
    };

    socket.onerror = () => {
      clients.delete(socket);
    };

    return response;
  }

  return new Response(page, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
});