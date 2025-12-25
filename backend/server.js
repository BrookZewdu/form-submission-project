const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const multerS3 = require("multer-s3");
const AWS = require("aws-sdk");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const generateShortId = () =>
  Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 6);
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Storage configuration - can switch between local and Spaces
const USE_SPACES = process.env.USE_SPACES === "true";

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || true, // Allow all origins in production
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve React build files (for production)
if (process.env.NODE_ENV === "production") {
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, "build")));
  console.log("📱 Serving React app from /build directory");
} else {
  console.log("🔧 Development mode - React served separately on port 3000");
}

// Serve uploaded images (for local storage only)
if (!USE_SPACES) {
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));
}

// Database connection
const dbPath = path.join(__dirname, "database", "users.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  } else {
    console.log("Connected to SQLite database");
    // Create app_config table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )
    `, (err) => {
      if (err) {
        console.error("Error creating app_config table:", err.message);
      } else {
        // Insert default auto_reply_message if not exists
        db.run(`
          INSERT OR IGNORE INTO app_config (key, value, updated_at)
          VALUES ('auto_reply_message', 'Thank you for your pledge!', datetime('now'))
        `);
      }
    });
  }
});

// Configure Digital Ocean Spaces (S3-compatible)
let spacesEndpoint;
if (USE_SPACES) {
  spacesEndpoint = new AWS.S3({
    endpoint: new AWS.Endpoint(process.env.SPACES_ENDPOINT),
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET_KEY,
    region: process.env.SPACES_REGION || "nyc3",
    s3ForcePathStyle: false,
    signatureVersion: "v4",
  });

  console.log(`📦 Using Digital Ocean Spaces: ${process.env.SPACES_BUCKET}`);
} else {
  console.log("📁 Using local file storage");
}

// Configure multer for image uploads
let upload;

if (USE_SPACES) {
  // Digital Ocean Spaces upload configuration
  upload = multer({
    storage: multerS3({
      s3: spacesEndpoint,
      bucket: process.env.SPACES_BUCKET,
      acl: "public-read",
      key: function (req, file, cb) {
        const uniqueName = `images/${uuidv4()}${path.extname(
          file.originalname
        )}`;
        cb(null, uniqueName);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
      metadata: function (req, file, cb) {
        cb(null, {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        });
      },
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error("Only image files (JPG, PNG, GIF, WebP) are allowed!"));
      }
    },
  });
} else {
  // Local storage configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, "uploads", "images");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  });

  upload = multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        return cb(null, true);
      } else {
        cb(new Error("Only image files (JPG, PNG, GIF, WebP) are allowed!"));
      }
    },
  });
}

// Utility function to validate image dimensions (for local files only)
async function validateImageSize(imagePath, maxWidth = 4000, maxHeight = 4000) {
  try {
    const metadata = await sharp(imagePath).metadata();

    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      return {
        valid: false,
        message: `Image dimensions too large. Maximum allowed: ${maxWidth}x${maxHeight}px. Your image: ${metadata.width}x${metadata.height}px`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: "Invalid image file",
    };
  }
}

// API Routes (prefixed with /api to avoid conflicts with React routes)

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Form Submission Backend + React Frontend",
    storage: USE_SPACES ? "Digital Ocean Spaces" : "Local Storage",
    spaces_bucket: USE_SPACES ? process.env.SPACES_BUCKET : "N/A",
  });
});

// Get config value
app.get("/api/config/:key", (req, res) => {
  const { key } = req.params;
  db.get("SELECT value, updated_at FROM app_config WHERE key = ?", [key], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, error: "Config key not found" });
    }
    res.json({ success: true, key, value: row.value, updated_at: row.updated_at });
  });
});

// Set config value
app.post("/api/config/:key", (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ success: false, error: "Value is required" });
  }

  db.run(
    `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, value],
    function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      console.log(`✅ Config updated: ${key} = ${value}`);
      res.json({ success: true, key, value, updated_at: new Date().toISOString() });
    }
  );
});

// Get all users (for gallery)
app.get("/api/users", (req, res) => {
  db.all(
    `
    SELECT 
      id, 
      name,
      image_url,
      created_at
    FROM users 
    ORDER BY created_at DESC
  `,
    (err, rows) => {
      if (err) {
        console.error("Error fetching users:", err.message);
        res.status(500).json({
          success: false,
          error: "Internal server error",
        });
      } else {
        res.json({
          success: true,
          data: rows,
          count: rows.length,
          storage_type: USE_SPACES ? "spaces" : "local",
        });
      }
    }
  );
});

// Get specific user by ID
app.get("/api/users/:id", (req, res) => {
  const { id } = req.params;

  db.get(
    `
    SELECT 
      id, 
      name,
      image_url,
      image_path,
      created_at
    FROM users 
    WHERE id = ?
  `,
    [id],
    (err, row) => {
      if (err) {
        console.error("Error fetching user:", err.message);
        res.status(500).json({
          success: false,
          error: "Internal server error",
        });
      } else if (!row) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
      } else {
        res.json({
          success: true,
          data: row,
        });
      }
    }
  );
});

// Update user name by ID
app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  // Validation
  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      error: "Name is required",
    });
  }

  // First check if user exists
  db.get("SELECT id FROM users WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error("Error checking user existence:", err.message);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }

    if (!row) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Update the user's name
    const stmt = db.prepare("UPDATE users SET name = ? WHERE id = ?");

    stmt.run([name.trim(), id], function (err) {
      if (err) {
        console.error("Error updating user name:", err.message);
        res.status(500).json({
          success: false,
          error: "Internal server error",
        });
      } else if (this.changes === 0) {
        res.status(404).json({
          success: false,
          error: "User not found",
        });
      } else {
        // Fetch and return the updated user data
        db.get(
          `
          SELECT 
            id, 
            name,
            image_url,
            image_path,
            created_at
          FROM users 
          WHERE id = ?
        `,
          [id],
          (err, updatedRow) => {
            if (err) {
              console.error("Error fetching updated user:", err.message);
              res.status(500).json({
                success: false,
                error: "Update successful but could not fetch updated data",
              });
            } else {
              console.log(
                `✅ Updated user name: ${updatedRow.name} (ID: ${id})`
              );

              res.json({
                success: true,
                message: "Name updated successfully",
                data: updatedRow,
              });
            }
          }
        );
      }
    });

    stmt.finalize();
  });
});

// Submit form with image upload
app.post("/api/submit", upload.single("image"), async (req, res) => {
  try {
    const { name } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: "Name is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Image is required",
      });
    }

    const userId = generateShortId();
    let imagePath, imageUrl;

    if (USE_SPACES) {
      // Digital Ocean Spaces
      imagePath = req.file.key;
      imageUrl = req.file.location;

      console.log(`📦 Image uploaded to Spaces: ${imageUrl}`);
    } else {
      // Local storage
      imagePath = req.file.path;
      imageUrl = `${req.protocol}://${req.get("host")}/uploads/images/${
        req.file.filename
      }`;

      // Validate image dimensions for local files
      const imageValidation = await validateImageSize(req.file.path);
      if (!imageValidation.valid) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error("Error cleaning up file:", unlinkErr.message);
        }

        return res.status(400).json({
          success: false,
          error: imageValidation.message,
        });
      }

      console.log(`📁 Image uploaded locally: ${imageUrl}`);
    }

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO users (id, name, image_path, image_url)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run([userId, name.trim(), imagePath, imageUrl], function (err) {
      if (err) {
        console.error("Error inserting user:", err.message);

        // Clean up uploaded file on error (local only)
        if (!USE_SPACES && req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkErr) {
            console.error("Error cleaning up file:", unlinkErr.message);
          }
        }

        res.status(500).json({
          success: false,
          error: "Internal server error",
        });
      } else {
        const userData = {
          id: userId,
          name: name.trim(),
          image_url: imageUrl,
          created_at: new Date().toISOString(),
          storage_type: USE_SPACES ? "spaces" : "local",
        };

        console.log(`✅ New submission: ${userData.name}`);

        res.status(201).json({
          success: true,
          message: "Form submitted successfully",
          data: userData,
        });
      }
    });

    stmt.finalize();
  } catch (error) {
    console.error("Error in form submission:", error.message);

    // Clean up uploaded file on error (local only)
    if (!USE_SPACES && req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error("Error cleaning up file:", unlinkErr.message);
      }
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Delete all users (clear gallery) - also removes images from Spaces
app.delete("/api/users", async (req, res) => {
  try {
    // First, get all users to find their image paths
    const users = await new Promise((resolve, reject) => {
      db.all("SELECT id, image_path FROM users", (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Delete images from Spaces if enabled
    if (USE_SPACES && spacesEndpoint && users.length > 0) {
      for (const user of users) {
        if (user.image_path) {
          try {
            await spacesEndpoint
              .deleteObject({
                Bucket: process.env.SPACES_BUCKET,
                Key: user.image_path,
              })
              .promise();
            console.log(`🗑️ Deleted from Spaces: ${user.image_path}`);
          } catch (e) {
            console.error(
              `Failed to delete ${user.image_path} from Spaces:`,
              e.message
            );
          }
        }
      }
    }

    // Clear the database
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM users", function (err) {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`✅ Cleared ${users.length} users and their images`);
    res.json({ success: true, message: `Cleared ${users.length} images` });
  } catch (error) {
    console.error("Error clearing users:", error);
    res.status(500).json({ success: false, error: "Failed to clear gallery" });
  }
});

// ==================== VOTING API ROUTES ====================

// Get votes
app.get("/api/votes", (req, res) => {
  db.all("SELECT * FROM votes ORDER BY created_at DESC", (err, votes) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get("SELECT * FROM voting_config WHERE id = 1", (err, config) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(
        "SELECT * FROM voting_history ORDER BY ended_at DESC",
        (err, history) => {
          // Also fetch pending votes
          db.all(
            "SELECT * FROM pending_votes ORDER BY created_at DESC",
            (err, pendingVotes) => {
              res.json({
                currentRound: config?.current_round || 1,
                roundStatus: config?.status || "stopped",
                votes: votes || [],
                pendingVotes: pendingVotes || [],
                roundHistory: (history || []).map((h) => ({
                  round: h.round,
                  votes: JSON.parse(h.votes_json),
                  endedAt: h.ended_at,
                })),
              });
            }
          );
        }
      );
    });
  });
});

// Submit vote
app.post("/api/votes", (req, res) => {
  const { phoneNumber, letter } = req.body;

  db.get(
    "SELECT current_round, status FROM voting_config WHERE id = 1",
    (err, config) => {
      if (err) return res.status(500).json({ error: err.message });

      // If voting is not running, store as pending vote instead of rejecting
      if (config?.status !== "running") {
        // Store in pending_votes table
        db.run(
          "INSERT INTO pending_votes (phone_number, letter, created_at) VALUES (?, ?, ?)",
          [phoneNumber, letter.toUpperCase(), new Date().toISOString()],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });

            console.log(`📝 Pending vote stored: ${phoneNumber} → ${letter.toUpperCase()}`);
            res.json({
              success: true,
              pending: true,
              vote: {
                id: this.lastID.toString(),
                phoneNumber,
                letter: letter.toUpperCase(),
                createdAt: new Date().toISOString(),
              },
            });
          }
        );
        return;
      }

      const currentRound = config?.current_round || 1;

      db.get(
        "SELECT * FROM votes WHERE phone_number = ? AND round = ?",
        [phoneNumber, currentRound],
        (err, existing) => {
          if (existing) {
            return res.status(400).json({
              success: false,
              error: "Phone number already voted in this round",
            });
          }

          db.run(
            "INSERT INTO votes (phone_number, letter, round, created_at) VALUES (?, ?, ?, ?)",
            [
              phoneNumber,
              letter.toUpperCase(),
              currentRound,
              new Date().toISOString(),
            ],
            function (err) {
              if (err) return res.status(500).json({ error: err.message });

              res.json({
                success: true,
                vote: {
                  id: this.lastID.toString(),
                  phoneNumber,
                  letter: letter.toUpperCase(),
                  round: currentRound,
                  createdAt: new Date().toISOString(),
                },
              });
            }
          );
        }
      );
    }
  );
});

// Delete vote
app.delete("/api/votes/:voteId", (req, res) => {
  db.run("DELETE FROM votes WHERE id = ?", [req.params.voteId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Update voting status
app.post("/api/votes/status", (req, res) => {
  const { status } = req.body;

  db.get("SELECT * FROM voting_config WHERE id = 1", (err, config) => {
    if (err) return res.status(500).json({ error: err.message });

    const oldStatus = config?.status || "stopped";

    if (status === "stopped" && oldStatus !== "stopped") {
      // Archive current round
      db.all(
        "SELECT * FROM votes WHERE round = ?",
        [config.current_round],
        (err, roundVotes) => {
          if (!err && roundVotes.length > 0) {
            db.run(
              "INSERT INTO voting_history (round, votes_json, ended_at) VALUES (?, ?, ?)",
              [
                config.current_round,
                JSON.stringify(roundVotes),
                new Date().toISOString(),
              ]
            );
          }

          // Clear votes and increment round
          db.run("DELETE FROM votes WHERE round = ?", [config.current_round]);
          db.run(
            "UPDATE voting_config SET status = ?, current_round = current_round + 1 WHERE id = 1",
            [status],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });

              db.get(
                "SELECT * FROM voting_config WHERE id = 1",
                (err, newConfig) => {
                  res.json({
                    success: true,
                    currentRound: newConfig?.current_round || 1,
                    roundStatus: newConfig?.status || "stopped",
                  });
                }
              );
            }
          );
        }
      );
    } else {
      // If changing to "running", clear pending votes (discard them)
      if (status === "running") {
        db.run("DELETE FROM pending_votes", (err) => {
          if (err) console.error("Error clearing pending votes:", err.message);
          else console.log("🗑️ Cleared pending votes on voting start");
        });
      }

      db.run(
        "UPDATE voting_config SET status = ? WHERE id = 1",
        [status],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({
            success: true,
            currentRound: config?.current_round || 1,
            roundStatus: status,
          });
        }
      );
    }
  });
});

// Clear voting display
app.post("/api/votes/clear", (req, res) => {
  db.get("SELECT * FROM voting_config WHERE id = 1", (err, config) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(
      "SELECT * FROM votes WHERE round = ?",
      [config.current_round],
      (err, votes) => {
        if (!err && votes.length > 0) {
          db.run(
            "INSERT INTO voting_history (round, votes_json, ended_at) VALUES (?, ?, ?)",
            [
              config.current_round,
              JSON.stringify(votes),
              new Date().toISOString(),
            ]
          );
        }

        db.run(
          "DELETE FROM votes WHERE round = ?",
          [config.current_round],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.run(
              "UPDATE voting_config SET status = ? WHERE id = 1",
              ["stopped"],
              (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
              }
            );
          }
        );
      }
    );
  });
});

// Twilio webhook
app.post("/api/twilio/webhook", (req, res) => {
  try {
    const { From, Body } = req.body;
    if (!From || !Body) return res.status(400).send("Missing fields");

    const phoneNumber = From;
    const message = Body.trim();
    const isSingleLetter = /^[A-Fa-f]$/i.test(message);

    if (isSingleLetter) {
      // Vote
      const letter = message.toUpperCase();

      db.get(
        "SELECT current_round, status FROM voting_config WHERE id = 1",
        (err, config) => {
          // If voting is not running, store as pending vote
          if (config?.status !== "running") {
            db.run(
              "INSERT INTO pending_votes (phone_number, letter, created_at) VALUES (?, ?, ?)",
              [phoneNumber, letter, new Date().toISOString()],
              (err) => {
                if (!err)
                  console.log(`📝 Pending vote stored: ${phoneNumber} → ${letter}`);
                else
                  console.log(`⚠️ Error storing pending vote: ${err.message}`);
              }
            );
            return;
          }

          const currentRound = config?.current_round || 1;

          db.get(
            "SELECT * FROM votes WHERE phone_number = ? AND round = ?",
            [phoneNumber, currentRound],
            (err, existing) => {
              if (!existing) {
                db.run(
                  "INSERT INTO votes (phone_number, letter, round, created_at) VALUES (?, ?, ?, ?)",
                  [phoneNumber, letter, currentRound, new Date().toISOString()],
                  (err) => {
                    if (!err)
                      console.log(`✅ Vote: ${phoneNumber} → ${letter}`);
                  }
                );
              } else {
                console.log(`⚠️ Duplicate vote: ${phoneNumber}`);
              }
            }
          );
        }
      );

      res.type("text/xml").send("<Response></Response>");
    } else {
      // Donation
      const amountMatch = message.match(/\d+/);
      const amount = amountMatch ? parseInt(amountMatch[0]) : 0;
      const dedication =
        message.trim() === (amountMatch?.[0] || "") ? "" : message;

      const donationId = Date.now().toString();
      db.run(
        "INSERT INTO donations (id, phone, amount, message, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          donationId,
          phoneNumber,
          amount,
          dedication,
          "twilio",
          new Date().toISOString(),
        ],
        (err) => {
          if (err) console.error("Donation error:", err);
          else console.log(`💰 Donation: ${phoneNumber} → $${amount}`);
        }
      );

      // Auto-reply from config
      db.get(
        "SELECT value FROM app_config WHERE key = 'auto_reply_message'",
        (err, row) => {
          const reply = row?.value || "Thank you for your pledge!";
          res
            .type("text/xml")
            .send(`<Response><Message>${reply}</Message></Response>`);
        }
      );
    }
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Error");
  }
});

// Get donations by tags
app.get("/api/donations", (req, res) => {
  const { tags } = req.query;

  let query = "SELECT * FROM donations ORDER BY created_at DESC";
  let params = [];

  if (tags) {
    query = "SELECT * FROM donations WHERE tags = ? ORDER BY created_at DESC";
    params = [tags];
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({
      success: true,
      data: rows.map((row) => ({
        donationId: row.id,
        display_name: row.phone,
        date: row.created_at,
        formData: {
          attributes: {
            real_payment: row.amount,
            dedication: row.message || "",
          },
        },
      })),
      count: rows.length,
    });
  });
});

// Serve React app for all non-API routes (this must be last!)
if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File too large. Maximum size is 10MB.",
      });
    }
  }

  if (error.message === "Only image files (JPG, PNG, GIF, WebP) are allowed!") {
    return res.status(400).json({
      success: false,
      error: "Only image files (JPG, PNG, GIF, WebP) are allowed!",
    });
  }

  console.error("Unhandled error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// 404 handler for API routes only
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API route not found",
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err.message);
    } else {
      console.log("Database connection closed");
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Form Submission App running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(
    `📊 Storage: ${USE_SPACES ? "Digital Ocean Spaces" : "Local Files"}`
  );

  if (process.env.NODE_ENV === "production") {
    console.log(`📱 React app: http://localhost:${PORT}/`);
    console.log(`🔗 API endpoints: http://localhost:${PORT}/api/*`);
  } else {
    console.log(`🔧 Development: Run React separately on port 3000`);
    console.log(`🔗 API endpoints: http://localhost:${PORT}/api/*`);
  }
});
