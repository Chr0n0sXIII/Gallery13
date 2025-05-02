import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const SERVER_URL = "/api"; // Adjust if deployed

const Bin = () => {
  const [user, setUser] = useState(null);
  const [deletedFiles, setDeletedFiles] = useState([]);
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        loadBin(u.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadBin = async (uid) => {
    try {
      const res = await fetch(`${SERVER_URL}/bin/${uid}`);
      const { files } = await res.json();
      setDeletedFiles(files);
    } catch (err) {
      console.error("Failed to load bin:", err);
    }
  };

  const restoreFile = async (filename) => {
    try {
      const res = await fetch(`${SERVER_URL}/restore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.uid, filename }),
      });
      if (!res.ok) throw new Error("Restore failed");
      setDeletedFiles((prev) => prev.filter((f) => f.filename !== filename));
    } catch (err) {
      alert(err.message);
    }
  };

  const timeRemaining = (deletedAt) => {
    const msLeft = 7 * 24 * 60 * 60 * 1000 - (Date.now() - new Date(deletedAt));
    const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
    return `${days}d ${hours}h left`;
  };
const binUrl = (filename) => `${SERVER_URL}/bin/${user?.uid}/${filename}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Bin</h1>
      {deletedFiles.length === 0 ? (
        <p className="text-center text-gray-500">Your bin is empty.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {deletedFiles.map(({ filename, deletedAt }, idx) => {
            const isVideo = /\.(mp4|mov)$/i.test(filename); 
            const url = binUrl(filename);
            return (
              <div
                key={idx}
                className="relative bg-white rounded-lg shadow overflow-hidden"
              >
                <div className="aspect-square overflow-hidden">
                  {isVideo ? (
                    <video
                      src={url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  )}
                </div>
                <div className="p-2 text-sm flex justify-between items-center">
                  <span className="text-gray-500">{timeRemaining(deletedAt)}</span>
                  <button
                    onClick={() => restoreFile(filename)}
                    className="text-blue-600 hover:underline"
                  >
                    Restore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Bin;
