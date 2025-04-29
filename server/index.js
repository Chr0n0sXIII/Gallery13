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
const db = new Low(adapter,{files:[]});
await db.read();
db.data ||= { files: [] }; // Initialize if empty

// File storage setup
const upload = multer({ dest: 'temp/' });

const UPLOADS_DIR = path.join('uploads');
const THUMBS_DIR = path.join('thumbs');

// Ensure folders exist
await fs.ensureDir(UPLOADS_DIR);
await fs.ensureDir(THUMBS_DIR);

// Helper functions
const moveAndProcessFile = async (tempPath, userId, filename) => {
  const userUploadPath = path.join(UPLOADS_DIR, userId);
  const userThumbPath = path.join(THUMBS_DIR, userId);

  await fs.ensureDir(userUploadPath);
  await fs.ensureDir(userThumbPath);

  const newPath = path.join(userUploadPath, filename);
  const thumbPath = path.join(userThumbPath, filename);

  // Move original
  await fs.move(tempPath, newPath, { overwrite: true });

  // Create thumbnail if it's an image
  if (/\.(jpe?g|png|webp)$/i.test(filename)) {
    await sharp(newPath)
      .resize(412, 412)
      .toFile(thumbPath);
  }
};

// Routes

// Test route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Upload route
app.post('/upload', upload.array('files'), async (req, res) => {
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
        userId,
        filename: newFilename,
        uploadedAt: Date.now()
      };

      db.data.files.push(fileEntry);
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
app.get('/uploads/:userId', async (req, res) => {
  const { userId } = req.params;
  const userFiles = db.data.files.filter(file => file.userId === userId);
  res.json({ files: userFiles });
});

// Get thumbnails
app.get('/thumbs/:userId/:filename', async (req, res) => {
  const { userId, filename } = req.params;
  const thumbPath = path.join(THUMBS_DIR, userId, filename);
  
  if (await fs.pathExists(thumbPath)) {
    res.sendFile(path.resolve(thumbPath));
  } else {
    res.status(404).json({ message: 'Thumbnail not found' });
  }
});

// Serve full-size files
app.get('/uploads/:userId/:filename', async (req, res) => {
  const { userId, filename } = req.params;
  const filePath = path.join(UPLOADS_DIR, userId, filename);

  if (await fs.pathExists(filePath)) {
    res.sendFile(path.resolve(filePath));
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Delete file
app.delete('/delete', async (req, res) => {
  try {
    const { userId, filename } = req.body;
    if (!userId || !filename) return res.status(400).json({ message: 'Missing userId or filename' });

    // Remove from DB
    db.data.files = db.data.files.filter(file => !(file.userId === userId && file.filename === filename));
    await db.write();

    // Delete files
    await fs.remove(path.join(UPLOADS_DIR, userId, filename));
    await fs.remove(path.join(THUMBS_DIR, userId, filename));

    res.json({ message: 'File deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
