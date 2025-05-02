const fs = require("fs");
const path = require("path");

const BIN_DIR = path.join(__dirname, "bin");
const THUMBS_DIR = path.join(__dirname, "thumbs");
const DELETE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cleanupBin() {
  const now = Date.now();
  if (!fs.existsSync(BIN_DIR)) return;

  fs.readdirSync(BIN_DIR).forEach((userId) => {
    const userBinPath = path.join(BIN_DIR, userId);
    if (!fs.statSync(userBinPath).isDirectory()) return;

    fs.readdirSync(userBinPath).forEach((file) => {
      if (!file.endsWith(".json")) return;

      const metaPath = path.join(userBinPath, file);
      const metadata = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      const { filename, deletedAt } = metadata;

      if (now - deletedAt >= DELETE_AFTER_MS) {
        // Delete the actual file
        const filePath = path.join(userBinPath, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        // Delete the metadata 
        fs.unlinkSync(metaPath);

        // Delete thumb
        const thumbPath = path.join(THUMBS_DIR, userId, filename);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

        console.log(`Deleted expired file: ${filename}`);
      }
    });
  });
}

export const cleanupBin = cleanupBin();