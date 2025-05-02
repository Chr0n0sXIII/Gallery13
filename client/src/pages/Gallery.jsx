import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const SERVER_URL = "/api";

const Gallery = () => {
  const [user, setUser] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const navigate = useNavigate();

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

  const loadFiles = async (uid) => {
    try {
      const res = await fetch(`${SERVER_URL}/uploads/${uid}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      let { files } = await res.json();

      // Simulate uploadDate if not present (replace this with real data when available)
      files = files.map((file) => ({
        ...file,
        uploadDate: file.uploadDate || new Date().toISOString(),
      }));

      // Sort by date descending
      files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

      setUploadedFiles(files);
    } catch (err) {
      console.error(err);
    }
  };

  const groupByMonth = (files) => {
    const groups = {};
    for (const file of files) {
      const date = new Date(file.uploadDate);
      const key = date.toLocaleString("default", { month: "long", year: "numeric" });
      if (!groups[key]) groups[key] = [];
      groups[key].push(file);
    }
    return groups;
  };

  const groupedFiles = groupByMonth(uploadedFiles);

  const handleFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return alert("Select files first");
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
      const filesWithDate = newFiles.map((f) => ({
        ...f,
        uploadDate: new Date().toISOString(),
      }));
      setUploadedFiles((prev) => [...prev, ...filesWithDate]);
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
      setUploadedFiles((prev) => prev.filter((f) => f.filename !== filename));
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const thumbUrl = (filename) => `${SERVER_URL}/thumbs/${user?.uid}/${filename}`;
  const fileUrl = (filename) => `${SERVER_URL}/uploads/${user?.uid}/${filename}`;

  const flatFiles = Object.values(groupedFiles).flat();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Your Gallery</h1>
      <button
          onClick={() => navigate(`/bin`)}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          View Bin
        </button>

      {/* Upload */}
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

      {/* Gallery */}
      {uploadedFiles.length > 0 ? (
        Object.entries(groupedFiles).map(([monthYear, files], groupStartIdx) => (
          <div key={monthYear} className="mb-10">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-1">{monthYear}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {files.map((file, idx) => {
                const thumb = thumbUrl(file.filename);
                const fullRes = fileUrl(file.filename);
                const isVideo = /\.(mp4|mov)$/i.test(file.filename);
                const flatIndex = flatFiles.findIndex((f) => f.filename === file.filename);
                return (
                  <div
                    key={idx}
                    className="relative group cursor-pointer"
                    onClick={() => setPreviewIndex(flatIndex)}
                  >
                    <div className="w-full aspect-square overflow-hidden rounded-lg shadow hover:scale-105 transition-transform">
                      {isVideo ? (
                        <video
                          src={fullRes}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.filename);
                      }}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <p className="text-gray-500 mt-8 text-center">No media uploaded yet.</p>
      )}

      {/* Modal */}
      {previewIndex !== null && flatFiles[previewIndex] && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 overflow-auto p-8">
          <button
            onClick={() => setPreviewIndex(null)}
            className="absolute top-4 right-4 text-white text-3xl font-bold"
          >
            ✖
          </button>

          {previewIndex > 0 && (
            <button
              onClick={() => setPreviewIndex((i) => i - 1)}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-5xl font-bold px-3 py-1 hover:bg-white hover:text-black rounded-full bg-black bg-opacity-30"
            >
              ‹
            </button>
          )}

          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center">
            {(() => {
              const file = flatFiles[previewIndex];
              const isVideo = /\.(mp4|mov)$/i.test(file.filename);
              const fullUrl = fileUrl(file.filename);
              return isVideo ? (
                <video
                  src={fullUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-[80vh] rounded-lg"
                />
              ) : (
                <img
                  src={fullUrl}
                  alt=""
                  className="max-w-full max-h-[80vh] rounded-lg object-contain"
                />
              );
            })()}
            <a
              href={fileUrl(flatFiles[previewIndex].filename)}
              download
              className="mt-4 bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition shadow"
            >
              ⬇ Download
            </a>
          </div>

          {previewIndex < flatFiles.length - 1 && (
            <button
              onClick={() => setPreviewIndex((i) => i + 1)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-5xl font-bold px-3 py-1 hover:bg-white hover:text-black rounded-full bg-black bg-opacity-30"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Gallery;
