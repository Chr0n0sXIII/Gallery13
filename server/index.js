// index.js
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import fs from 'fs-extra';
import path from 'path';

// Setup server
const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// LowDB setup
const adapter = new JSONFile('db.json');
const db = new Low(adapter, { files: [] });
await db.read();
 // Initialize if empty
db.data ||= {};
db.data.bin ||= {};
db.data.uploads ||= {};

// File storage setup
const upload = multer({ dest: 'temp/' });
const UPLOADS_DIR = path.join('uploads');
const THUMBS_DIR = path.join('thumbs');
const BIN_DIR = path.join('bin')

// Ensure folders exist
await fs.ensureDir(UPLOADS_DIR);
await fs.ensureDir(THUMBS_DIR);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


// Helper functions
const moveAndProcessFile = async (tempPath, userId, filename) => {
  const userUploadPath = path.join(UPLOADS_DIR, userId);
  const userThumbPath = path.join(THUMBS_DIR, userId);

  await fs.ensureDir(userUploadPath);
  await fs.ensureDir(userThumbPath);

  const newPath = path.join(userUploadPath, filename);
  const thumbPath = path.join(userThumbPath, filename);

  // Move original file
  await fs.move(tempPath, newPath, { overwrite: true });

  // Generate thumbnail if it's an image
  if (/\.(jpe?g|png|webp)$/i.test(filename)) {
    await sharp(newPath)
      .resize(412, 412)  // Resize to thumbnail size
      .toFile(thumbPath); // Save the thumbnail
  }
};

// Routes

// Test route
app.get('/api', (req, res) => {
  res.send('Server is running!');
});

// Upload route
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(400).json({ message: 'Missing user ID' });

    const uploadedFiles = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname);
      const newFilename = nanoid() + ext;

      await moveAndProcessFile(file.path, userId, newFilename);

      const fileEntry = {
        id: nanoid(),
        filename: newFilename,
        uploadedAt: Date.now()
      };
      db.data.uploads[userId]= db.data.uploads[userId]||[];
      db.data.uploads[userId].push(fileEntry);
      uploadedFiles.push(fileEntry);
    }

    await db.write();
    res.json({ files: uploadedFiles });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Get uploads for user
app.get('/api/uploads/:userId', async (req, res) => {
  const { userId } = req.params;
  const userFiles = db.data.uploads[userId];
  res.json({ files: userFiles });
});

// Get thumbnails

app.get('/api/thumbs/:userId/:filename', async (req, res) => {
  const { userId, filename } = req.params;
  const thumbPath = path.join(THUMBS_DIR, userId, filename);

  try {
    // First check
    if (await fs.pathExists(thumbPath)) {
      return res.sendFile(path.resolve(thumbPath));
    }

    // Wait 5 seconds and retry
    await delay(5000);

    if (await fs.pathExists(thumbPath)) {
      return res.sendFile(path.resolve(thumbPath));
    }

    // If still not found
    res.status(404).json({ message: 'Thumbnail not found after retry' });
  } catch (error) {
    console.error('Error fetching thumbnail:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Serve full-size files
app.get('/api/uploads/:userId/:filename', async (req, res) => {
  const { userId, filename } = req.params;
  const filePath = path.join(UPLOADS_DIR, userId, filename);

  if (await fs.pathExists(filePath)) {
    res.sendFile(path.resolve(filePath));
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Bin Route
app.get("/api/bin/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Ensure bin structure exists
    const userBin = db.data.bin?.[userId] || [];

    // Map to return metadata
    const files = userBin.map(entry => ({
      filename: entry.filename,
      deletedAt: entry.deletedAt,
    }));

    res.json({ files });
  } catch (err) {
    console.error("Bin read error:", err);
    res.status(500).json({ message: "Failed to load bin" });
  }
});

//Fetch Bin Images
app.get('/api/bin/:userId/:filename', async (req, res) => {
  const { userId, filename } = req.params;
  const filePath = path.join(BIN_DIR, userId, filename);

  if (await fs.pathExists(filePath)) {
    res.sendFile(path.resolve(filePath));
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Restore Route
app.post("/api/restore", async (req, res) => {
  const { userId, filename } = req.body;
  if (!userId || !filename) {
    return res.status(400).json({ error: "Missing userId or filename" });
  }

  const binPath = path.join("bin", userId, filename);
  const uploadPath = path.join("uploads", userId, filename);

  try {
    // Ensure file exists in bin
    const userBin = db.data.bin[userId] || [];
    const fileEntry = userBin.find(f => f.filename === filename);
    if (!fileEntry || !fs.existsSync(binPath)) {
      return res.status(404).json({ error: "File not found in bin" });
    }

    // Move file from bin -> uploads
    fs.renameSync(binPath, uploadPath);

    // Update DB
    db.data.bin[userId] = userBin.filter(f => f.filename !== filename);
    db.data.uploads[userId] = db.data.uploads[userId] || [];
    db.data.uploads[userId].push({ filename, uploadedAt: Date.now() });

    await db.write();

    res.json({ success: true });
  } catch (err) {
    console.error("Restore error:", err);
    res.status(500).json({ error: "Failed to restore file" });
  }
});

// Delete file
app.delete("/api/delete", async (req, res) => {
  const { userId, filename } = req.body;
  if (!userId || !filename) return res.status(400).json({ message: "Missing data" });

  const userUploadPath = path.join("uploads", userId);
  const userBinPath = path.join("bin", userId);

  const filePath = path.join(userUploadPath, filename);
  const binPath = path.join(userBinPath, filename);

  try {
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

    // Create bin folder if missing
    fs.mkdirSync(userBinPath, { recursive: true });

     // Write metadata with deletion timestamp
    const metadata = {
      userId: userId,
      filename,
      deletedAt: Date.now(),
    };

    // Update bin DB
    
    db.data.bin[userId] = db.data.bin[userId] || [];
    db.data.bin[userId].push(metadata);
    if (db.data.uploads[userId]) {
      db.data.uploads[userId] = db.data.uploads[userId].filter(
        (file) => file.filename !== filename
      );
    }
    
    console.log(db.data.bin[userId]);
    await db.write();

    // Move file to bin
    fs.renameSync(filePath, binPath);
    res.json({ message: "Moved to bin" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to move file" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
