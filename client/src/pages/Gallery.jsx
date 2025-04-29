import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const SERVER_URL = "http://localhost:4000";

const Gallery = () => {
  const [user, setUser] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null); // <-- for preview modal

  // Watch auth state
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

  // Listen for ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setPreviewFile(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const handleFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files));
  };

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

  const thumbUrl = (filename) => `${SERVER_URL}/thumbs/${user?.uid}/${filename}`;
  const fileUrl = (filename) => `${SERVER_URL}/uploads/${user?.uid}/${filename}`;
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Your Gallery</h1>

      {/* Upload Controls */}
      <div className="mb-6 flex items-center space-x-4">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          className="border p-2 rounded"
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

      {/* Gallery Grid */}
      {uploadedFiles.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {uploadedFiles.map(({ filename }, idx) => {
            const thumb = thumbUrl(filename);
            const fullRes = fileUrl(filename);
            const isVideo = /\.(mp4|mov)$/i.test(filename);
            return (
              <div
                key={idx}
                className="relative group cursor-pointer"
                onClick={() => setPreviewFile({ url: fullRes, type: isVideo ? "video" : "image" })}
              >
                <div className="w-full aspect-square overflow-hidden rounded-lg shadow hover:scale-105 transition-transform">
                  {isVideo ? (
                    <video
                      src={fullRes}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={thumb}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(filename);
                  }}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 mt-8 text-center">No media uploaded yet.</p>
      )}

      {/* Preview Modal */}
      {previewFile && (
  <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 overflow-auto p-8">
    <button
        onClick={() => setPreviewFile(null)}
        className="absolute top-4 right-4 text-white text-3xl font-bold"
      >
        ✖
      </button>
    <div className="relative flex items-center justify-center">
      
      {previewFile.type === "video" ? (
        <video
          src={previewFile.url}
          controls
          autoPlay
          className="max-w-full max-h-[90vh] rounded-lg"
        />
      ) : (
        <img
          src={previewFile.url}
          alt=""
          className="max-w-full max-h-[90vh] rounded-lg object-contain"
        />
      )}
    </div>
  </div>
)}

    </div>
  );
};

export default Gallery;
