import React, { useState, useEffect } from "react";
import CodeEditor from "./components/CodeEditor";
import WebSocketService from "./services/WebSocketService";
import axios from "axios";
import "./App.css";

const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8080";

const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
];

function App() {
  const [username, setUsername] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [userId, setUserId] = useState("");
  const [userColor, setUserColor] = useState("");
  const [connected, setConnected] = useState(false);
  const [joinedDocument, setJoinedDocument] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Generate userId
    const id = "user_" + Math.random().toString(36).substr(2, 9);
    setUserId(id);

    // Random color
    setUserColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  }, []);

  useEffect(() => {
    if (connected && userId.startsWith("user_")) {
      WebSocketService.subscribeToUser(
        userId,
        "/queue/user/info",
        (userInfo) => {
          console.log(
            "🆔 Received real user ID from backend:",
            userInfo.userId,
          );
          setUserId(userInfo.userId);
          if (userInfo.color) {
            setUserColor(userInfo.color);
          }
        },
      );
    }
  }, [connected, userId]);

  const handleConnect = () => {
    if (!username.trim()) {
      alert("Please enter a username");
      return;
    }

    WebSocketService.connect(
      () => {
        console.log("✅ Connected to WebSocket!");
        setConnected(true);
      },
      (error) => {
        console.error("❌ Connection failed:", error);
        alert(
          "Failed to connect to server. Make sure backend is running on http://localhost:8080",
        );
      },
    );
  };

  const handleCreateDocument = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/documents`, null, {
        params: {
          title: `Document_${Date.now()}`,
          ownerId: userId,
          language: "javascript",
        },
      });

      console.log("✅ Document created:", response.data);
      setDocumentId(response.data.id);
      setJoinedDocument(true);
    } catch (error) {
      console.error("❌ Error creating document:", error);
      alert("Failed to create document. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinDocument = async () => {
    if (!inputValue.trim()) {
      alert("Please enter a document ID");
      return;
    }

    setLoading(true);
    try {
      // Verify document exists
      const response = await axios.get(
        `${API_URL}/api/documents/${inputValue.trim()}`,
      );
      console.log("✅ Document found:", response.data);

      setDocumentId(inputValue.trim());
      setJoinedDocument(true);
    } catch (error) {
      console.error("❌ Error joining document:", error);
      alert("Document not found. Please check the ID.");
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <h1>🚀 Real-Time Code Editor</h1>
          <p className="subtitle">Collaborate on code in real-time</p>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleConnect()}
            autoFocus
          />
          <button onClick={handleConnect} className="primary-btn">
            Connect
          </button>
        </div>
      </div>
    );
  }

  if (!joinedDocument) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <h2>Welcome, {username}! 👋</h2>
          <p className="subtitle">
            Create a new document or join an existing one
          </p>

          <button
            className="create-btn"
            onClick={handleCreateDocument}
            disabled={loading}
          >
            {loading ? "⏳ Creating..." : "📝 Create New Document"}
          </button>

          <div className="divider">OR</div>

          <input
            type="text"
            placeholder="Enter Document ID to join"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleJoinDocument()}
          />
          <button
            onClick={handleJoinDocument}
            disabled={loading}
            className="join-btn"
          >
            {loading ? "⏳ Joining..." : "🔗 Join Document"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="top-bar">
        <div className="left-section">
          <h3 className="app-title">💻 Code Editor</h3>
          <span className="username" style={{ color: userColor }}>
            ● {username}
          </span>
        </div>
        <div className="right-section">
          <div className="document-info">
            <span className="doc-label">Document ID:</span>
            <code className="doc-id">{documentId}</code>
            <button
              className="copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(documentId);
                alert("📋 Document ID copied to clipboard!");
              }}
            >
              📋 Copy
            </button>
          </div>
        </div>
      </div>

      <CodeEditor
        documentId={documentId}
        userId={userId}
        username={username}
        userColor={userColor}
      />
    </div>
  );
}

export default App;
