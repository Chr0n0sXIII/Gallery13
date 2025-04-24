const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 4000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer config for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const userFolder = path.join(uploadDir, req.headers["x-user-id"]);
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });  // Ensure folder exists
      }
      cb(null, userFolder);  // Set destination to the user's folder
      console.log('userfolder:', userFolder);
    },
    filename: (req, file, cb) => {
      // Generate unique filename (e.g., using timestamp to avoid name collisions)
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  });

const upload = multer({ storage });

// Enable CORS for frontend (React)
app.use(cors());
app.use(express.json());
// Serve uploaded files statically
app.use("/uploads", express.static(uploadDir));

// POST /upload route
app.post("/upload", (req, res) => {
    const userId = req.headers["x-user-id"];
    if (!userId) return res.status(400).json({ message: "Missing user ID" });
  
    // Create user's folder
    const userFolder = path.join(uploadDir, userId);
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }
  
    // Dynamic storage config based on user
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, userFolder),
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${file.originalname}`),
    });
  
    const upload = multer({ storage }).array("files");
  
    // Call multer to handle the upload
    upload(req, res, (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(500).json({ message: "Upload failed", error: err.message });
      }
  
      const uploadedFiles = req.files.map((file) => ({
        filename: file.filename,
        url: `/uploads/${userId}/${file.filename}`,
      }));
  
      res.status(200).json({
        message: "Upload successful",
        files: uploadedFiles,
      });
    });
  });
  
  //DELETE /delete Route
  app.delete("/delete", (req, res) => {
    const { userId, filename } = req.body;
    if (!userId || !filename) return res.status(400).json({ message: "Missing data" });
  
    const filePath = path.join(uploadDir, userId, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
  
    fs.unlink(filePath, (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete file" });
      res.status(200).json({ message: "File deleted" });
    });
  });
  
// GET /upload Route
app.get("/uploads/:userId", (req, res) => {
  const { userId } = req.params;
  const userFolder = path.join(uploadDir, userId);

  if (!fs.existsSync(userFolder)) {
    // No uploads yet
    return res.status(200).json({ files: [] });
  }

  // Read the directory contents
  const files = fs.readdirSync(userFolder).map((filename) => ({
    filename,
    url: `/uploads/${userId}/${filename}`,
  }));

  res.status(200).json({ files });
});
// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
