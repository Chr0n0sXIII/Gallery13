// src/pages/Gallery.jsx
import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const SERVER_URL = "http://localhost:4000";

const Gallery = () => {
  const [user, setUser] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Watch auth state and load files on login
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        loadFiles(u.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch existing uploads for the user
  const loadFiles = async (uid) => {
    try {
      const res = await fetch(`${SERVER_URL}/uploads/${uid}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const { files } = await res.json();
      setUploadedFiles(files);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle file input change
  const handleFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files));
  };

  // Upload selected files
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert("Select files first");
      return;
    }
    if (!window.confirm(`Upload ${selectedFiles.length} file(s)?`)) return;

    setUploading(true);
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    try {
      const res = await fetch(`${SERVER_URL}/upload`, {
        method: "POST",
        headers: { "x-user-id": user.uid },
        body: formData,
      });
      if (!res.ok) {
        const { message } = await res.json();
        throw new Error(message || "Upload failed");
      }
      const { files: newFiles } = await res.json();
      setUploadedFiles((prev) => [...prev, ...newFiles]);
      setSelectedFiles([]);
    } catch (err) {
      console.error(err);
      alert("Upload error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Delete a file
  const handleDelete = async (filename) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      const res = await fetch(`${SERVER_URL}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, filename }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setUploadedFiles((prev) =>
        prev.filter((f) => f.filename !== filename)
      );
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // Build file URL
  const fileUrl = (filename) =>
    `${SERVER_URL}/uploads/${user.uid}/${filename}`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Your Gallery</h1>

      {/* Upload controls */}
      <div className="mb-6 flex items-center space-x-4">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          className="border p-1 rounded"
        />
        {selectedFiles.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        )}
      </div>

      {/* Gallery grid */}
      {uploadedFiles.length > 0 ? (
        <div className="grid grid-flow-row auto-rows-[412px] auto-cols-[412px] gap-4 overflow-auto">
          {uploadedFiles.map(({ filename }, idx) => {
            const url = fileUrl(filename);
            const isVideo = /\.(mp4|mov)$/i.test(filename);
            return (
              <div key={idx} className="relative overflow-hidden rounded-lg shadow-lg group">
                <div className="w-[412px] h-[412px]">
                  {isVideo ? (
                    <video
                      src={url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="absolute top-1 right-1 flex space-x-2 opacity-0 group-hover:opacity-100 transition">
                  <a
                    href={url}
                    download
                    className="bg-white px-2 py-1 rounded text-sm shadow hover:bg-gray-100"
                  >
                    ⬇
                  </a>
                  <button
                    onClick={() => handleDelete(filename)}
                    className="bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500">No media uploaded yet.</p>
      )}
    </div>
  );
};

export default Gallery;
