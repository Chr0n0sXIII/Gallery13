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

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// LowDB setup
const adapter = new JSONFile('db.json');
const db = new Low(adapter,[]);
await db.read();

db.data ||= {};
db.data.files ||= [];
db.data.bin ||= [];

// File storage setup
const upload = multer({ dest: 'temp/' });

const UPLOADS_DIR = path.join('uploads');
const THUMBS_DIR = path.join('thumbs');
const BIN_DIR = path.join('bin');

await fs.ensureDir(UPLOADS_DIR);
await fs.ensureDir(THUMBS_DIR);
await fs.ensureDir(BIN_DIR);

// Helper: Move file and create thumbnail
const moveAndProcessFile = async (tempPath, userId, filename) => {
  const userUploadPath = path.join(UPLOADS_DIR, userId);
  const userThumbPath = path.join(THUMBS_DIR, userId);

  await fs.ensureDir(userUploadPath);
  await fs.ensureDir(userThumbPath);

  const newPath = path.join(userUploadPath, filename);
  const thumbPath = path.join(userThumbPath, filename);

  await fs.move(tempPath, newPath, { overwrite: true });

  if (/\.(jpe?g|png|webp)$/i.test(filename)) {
    await sharp(newPath).resize(412, 412).toFile(thumbPath);
  }
};

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

// Get user uploads
app.get('/api/uploads/:userId', async (req, res) => {
  const { userId } = req.params;
  const userFiles = db.data.files.filter(file => file.userId === userId);
  res.json({ files: userFiles });
});

// Get thumbnails
app.get('/api/thumbs/:userId/:filename', async (req, res) => {
  const { userId, filename } = req.params;
  const thumbPath = path.join(THUMBS_DIR, userId, filename);

  if (await fs.pathExists(thumbPath)) {
    res.sendFile(path.resolve(thumbPath));
  } else {
    res.status(404).json({ message: 'Thumbnail not found' });
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

// Bin route (get all files in bin for user)
app.get('/api/bin/:userId', (req, res) => {
  const { userId } = req.params;
  const userBinPath = path.join(BIN_DIR, userId);

  try {
    if (!fs.existsSync(userBinPath)) return res.json({ files: [] });

    const files = fs.readdirSync(userBinPath)
      .filter(f => !f.endsWith(".json"))
      .map(filename => {
        const metaPath = path.join(userBinPath, `${filename}.json`);
        const metadata = fs.existsSync(metaPath)
          ? JSON.parse(fs.readFileSync(metaPath, "utf-8"))
          : { deletedAt: null };

        return { filename, deletedAt: metadata.deletedAt };
      });

    res.json({ files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load bin" });
  }
});

// Serve bin image
app.get('/api/bin/:userId/:filename', async (req, res) => {
  const { userId, filename } = req.params;
  const filePath = path.join(BIN_DIR, userId, filename);
  if (await fs.pathExists(filePath)) {
    res.sendFile(path.resolve(filePath));
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Restore route
app.post('/api/restore', async (req, res) => {
  const { userId, filename } = req.body;
  if (!userId || !filename) {
    return res.status(400).json({ error: "Missing userId or filename" });
  }

  const userBinPath = path.join(BIN_DIR, userId);
  const userUploadPath = path.join(UPLOADS_DIR, userId);
  const binFilePath = path.join(userBinPath, filename);
  const restorePath = path.join(userUploadPath, filename);

  try {
    if (!await fs.pathExists(binFilePath)) {
      return res.status(404).json({ error: "File not found in bin" });
    }

    await fs.ensureDir(userUploadPath);
    await fs.move(binFilePath, restorePath);

    const thumbPath = path.join(THUMBS_DIR, userId, filename);
    if (/\.(jpe?g|png|webp)$/i.test(filename)) {
      await sharp(restorePath).resize(412, 412).toFile(thumbPath);
    }

    db.data.bin = db.data.bin.filter(f => !(f.userId === userId && f.filename === filename));
    db.data.files.push({
      id: nanoid(),
      userId,
      filename,
      uploadedAt: Date.now()
    });

    await db.write();

    res.json({ success: true });
  } catch (err) {
    console.error("Restore error:", err);
    res.status(500).json({ error: "Failed to restore file" });
  }
});

// Delete route (move to bin)
app.delete('/api/delete', async (req, res) => {
  const { userId, filename } = req.body;
  if (!userId || !filename) return res.status(400).json({ message: "Missing data" });

  const userUploadPath = path.join(UPLOADS_DIR, userId);
  const userBinPath = path.join(BIN_DIR, userId);

  const filePath = path.join(userUploadPath, filename);
  const binPath = path.join(userBinPath, filename);
  const metaPath = path.join(userBinPath, `${filename}.json`);

  try {
    if (!await fs.pathExists(filePath)) return res.status(404).json({ message: "File not found" });

    await fs.ensureDir(userBinPath);
    await fs.move(filePath, binPath);

    const metadata = {
      userId,
      filename,
      deletedAt: Date.now(),
    };
    await fs.writeJson(metaPath, metadata);

    db.data.files = db.data.files.filter(f => !(f.userId === userId && f.filename === filename));
    db.data.bin.push(metadata);
    await db.write();

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
