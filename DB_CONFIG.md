# Database Configuration - aJ Chat App

## Overview

This application uses **Deno KV** as its primary database for persistent storage. Deno KV is a key-value database built into Deno Deploy, providing fast, distributed data storage with automatic replication.

## Database Instance Details

**Production Database:**
- **Name:** `ajdb`
- **Engine:** Deno KV
- **Instance ID:** `422fef-production`
- **Region:** Auto-managed by Deno Deploy
- **Replication:** Automatic across multiple regions

**Preview/Development Database:**
- **Instance ID:** `422fef-local`
- **Purpose:** Used for preview deployments and testing
- **Timeline:** Separate database for each Git branch

## Data Schema

The database stores the following data types:

### 1. Messages
**Key Pattern:** `["messages", timestamp]`

```typescript
interface Message {
  type: "chat";
  id: string;
  user: "J" | "a";
  text?: string;
  media?: {
    type: string;
    name: string;
    data: string;
  };
  time: number;
  read: boolean;
  reactions?: Record<string, string[]>;
}
```

### 2. Shared Notes
**Key Pattern:** `["notes"]`

```typescript
type Notes = string; // Up to 50,000 characters
```

### 3. User Sessions
**Storage:** In-memory Map
```typescript
const clients = new Map<WebSocket, { 
  user: string | null; 
  mood?: string 
}>();
```

## Database Operations

### Read Operations
```typescript
// Get a single value
const result = await kv.get<string>(["notes"]);

// List values with prefix
const iter = kv.list<Message>({ prefix: ["messages"] });
for await (const entry of iter) {
  console.log(entry.value);
}
```

### Write Operations
```typescript
// Set a value
await kv.set(["messages", Date.now()], message);

// Delete a value
await kv.delete(["messages", messageId]);
```

## Environment Variables

When deployed to Deno Deploy, the following environment variables are automatically injected:

- `DATABASE_URL` - Connection URL for the database
- `PGHOST` - PostgreSQL-compatible host (for compatibility)
- Other Deno KV specific variables

**Note:** These variables are managed automatically by Deno Deploy and do not need to be configured manually.

## Local Development

### Using Local Database
For local development, Deno KV creates a file-based database in your project directory:

```bash
deno task start
# Creates a local KV database file
```

### Connecting to Production Database
To test with the production database locally:

```bash
deno run --tunnel main.ts
```

This command:
- Creates a secure tunnel to your Deno Deploy instance
- Allows local code to access the production database
- Useful for debugging and testing with real data

## Data Retention & Limits

- **Message Storage:** Last 100 messages are kept (see `getMessageHistory()`)
- **Message Size Limit:** 5,000 characters per text message
- **Media Storage:** Base64 encoded media stored inline
- **Notes Size Limit:** 50,000 characters
- **KV Storage Limit:** Managed by Deno Deploy plan

## Backup & Migration

Currently, the database is managed entirely by Deno Deploy. For backups:

1. **Export Data:** Create a script to list and export all entries
2. **Manual Backup:** Use `kv.list()` to iterate and save to JSON
3. **Deno Deploy Backups:** Automatic backups by the platform

## Security

- ✅ No direct database credentials needed
- ✅ Automatic encryption at rest
- ✅ Isolated per-deployment databases
- ✅ No SQL injection risk (key-value store)
- ✅ Environment variables auto-injected securely

## Monitoring

Access database metrics through:
- Deno Deploy Dashboard: https://dash.deno.com/
- Navigate to: `jeshwanth-a` → `aj-app` → `Databases`
- View: Storage usage, operation counts, performance metrics

## Troubleshooting

### Database Not Connected
- Verify the database is attached in Deno Deploy console
- Check that `await Deno.openKv()` is called successfully
- Review deployment logs for connection errors

### Data Not Persisting
- Ensure KV operations use `await`
- Verify write operations complete before response
- Check for quota/limit errors in logs

### Performance Issues
- Review number of `list()` operations
- Consider adding indexes for frequent queries
- Monitor KV operation latency in dashboard

## Future Enhancements

- [ ] Add data export/backup functionality
- [ ] Implement message archiving system
- [ ] Add data migration scripts
- [ ] Set up automated backup schedule
- [ ] Add database metrics dashboard

---

**Last Updated:** December 2025  
**Database Version:** Deno KV (Latest)  
**Maintained By:** aJ Team
