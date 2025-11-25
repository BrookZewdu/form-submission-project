const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

console.log("🔧 Initializing database for Digital Ocean Spaces setup...");

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, "database");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log("✅ Created database directory");
} else {
  console.log("📁 Database directory exists");
}

// Note: No need to create uploads/images directory when using Spaces
// Images will be stored in Digital Ocean Spaces bucket

const dbPath = path.join(dbDir, "users.db");

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Error opening database:", err.message);
    process.exit(1);
  } else {
    console.log("🗄️  Connected to SQLite database");
  }
});

// Create users table with single name field
db.serialize(() => {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_path TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) {
        console.error("❌ Error creating users table:", err.message);
        process.exit(1);
      } else {
        console.log("✅ Users table created successfully");
      }
    }
  );

  // Voting tables
  db.run(
    `
  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    letter TEXT NOT NULL,
    round INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
    (err) => {
      if (err) {
        console.error("❌ Error creating votes table:", err.message);
      } else {
        console.log("✅ Votes table created successfully");
      }
    }
  );

  db.run(
    `
  CREATE TABLE IF NOT EXISTS voting_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    current_round INTEGER DEFAULT 1,
    status TEXT DEFAULT 'stopped'
  )
`,
    (err) => {
      if (err) {
        console.error("❌ Error creating voting_config table:", err.message);
      } else {
        console.log("✅ Voting config table created successfully");
      }
    }
  );

  db.run(`INSERT OR IGNORE INTO voting_config (id) VALUES (1)`, (err) => {
    if (err) {
      console.error("❌ Error initializing voting config:", err.message);
    } else {
      console.log("✅ Voting config initialized");
    }
  });

  db.run(
    `
  CREATE TABLE IF NOT EXISTS voting_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round INTEGER NOT NULL,
    votes_json TEXT NOT NULL,
    ended_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
    (err) => {
      if (err) {
        console.error("❌ Error creating voting_history table:", err.message);
      } else {
        console.log("✅ Voting history table created successfully");
      }
    }
  );

  // Add some helpful logging
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) {
      console.error("❌ Error counting users:", err.message);
    } else {
      console.log(`📊 Current users in database: ${row.count}`);
    }
  });
});

db.close((err) => {
  if (err) {
    console.error("❌ Error closing database:", err.message);
    process.exit(1);
  } else {
    console.log("✅ Database initialization complete");
    console.log("📁 Database location:", dbPath);
    console.log("🌊 Ready for Digital Ocean Spaces image storage");
    console.log("");
    console.log("🚀 Next steps:");
    console.log("   1. Configure Spaces in .env file");
    console.log("   2. Set USE_SPACES=true");
    console.log("   3. Start server with: npm start");
  }
});
