# aJ 💕

A beautiful, private chat space for couples (J ↔ a) built with Deno.

## Features

- 💬 **Real-time messaging** with WebSocket
- 📸 **Media sharing** - photos, videos, audio
- 💾 **Persistent messages** with Deno KV
- 🎨 **5 beautiful themes** - Dark, Light, Midnight, Rose Gold, Forest
- 💭 **Mood status** - Let your partner know how you're feeling
- 📝 **Shared notes** - Keep notes together
- 📅 **Anniversary tracker** - Count your days together
- 💌 **Typing indicators & read receipts**
- 🔔 **Sound notifications** with multiple tones
- 📱 **PWA support** - Install as an app
- 🎯 **No passwords** - Just J and a

## Run Locally

```bash
deno task start
```

Or with hot-reload:

```bash
deno task dev
```

Then open http://localhost:8000 in two different browsers or devices. Choose user `J` in one and `a` in the other.

## Deploy to Deno Deploy

1. Push this repo to GitHub
2. Go to [dash.deno.com](https://dash.deno.com)
3. Create a new project and link this repo
4. Set entrypoint to `main.ts`
5. Deploy! 🚀

6. Attach a Deno KV database (Deno Deploy will auto-create and link the database)

## Database

This app uses **Deno KV** for data persistence. The database stores:

- 💬 **Chat messages** - All conversations are persisted with media support
- 📝 **Shared notes** - Collaborative notes between users
- 🔔 **User preferences** - Themes, settings, and mood status

### Database Instance

**Database Name**: `ajdb`  
**Engine**: Deno KV  
**Instance**: `422fef-local` (for preview deployments) / `422fef-production` (for production)

The database is automatically provisioned when deploying to Deno Deploy. Environment variables (`DATABASE_URL`, `PGHOST`, etc.) are automatically injected.

### Local Development

For local development, Deno KV will use a local file-based database. To connect to the production database locally:

```bash
deno run --tunnel main.ts
```

This securely connects your local environment to the Deno Deploy database.

**Live**: https://aj-app.jeshwanth-a.deno.net/

## Tech Stack

- **Runtime**: Deno
- **Database**: Deno KV
- **Real-time**: WebSocket
- **Styling**: Custom CSS with CSS Variables
- **Fonts**: Inter (Google Fonts)

## Structure

```
aJ/
├── main.ts          # Deno server with WebSocket & KV
├── public/
│   ├── index.html   # Main HTML
│   ├── styles.css   # Beautiful UI styles
│   ├── app.js       # Client-side logic
│   └── manifest.json # PWA manifest
├── deno.json        # Deno config
└── README.md
```

Made with ❤️ for a and J
