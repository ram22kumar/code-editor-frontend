import React, { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import WebSocketService from "../services/WebSocketService";
import "./CodeEditor.css";

const CodeEditor = ({ documentId, userId, username, userColor }) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const isRemoteChange = useRef(false);
  const versionRef = useRef(0);

  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [remoteCursors, setRemoteCursors] = useState(new Map());
  const [activeUsers, setActiveUsers] = useState([]);

  useEffect(() => {
    if (!documentId || !userId) return;

    console.log("Setting up WebSocket subscriptions for document:", documentId);

    // Subscribe to document sync (initial state)
    WebSocketService.subscribeToUser(
      userId,
      `/queue/document/${documentId}/existing-users`,
      (existingUser) => {
        console.log("👥 Received existing user:", existingUser);

        // Don't add yourself
        if (existingUser.username === username) {
          console.log("Skipping self from existing users");
          return;
        }

        setActiveUsers((prev) => {
          if (prev.find((u) => u.username === existingUser.username))
            return prev;
          console.log("Adding existing user to list:", existingUser.username);
          return [...prev, existingUser];
        });
      },
    );

    // Subscribe to document changes
    WebSocketService.subscribe(
      `/topic/document/${documentId}/changes`,
      (change) => {
        if (change.userId === userId) return; // Ignore own changes

        console.log("📝 Remote change from:", change.username);

        if (change.content !== undefined) {
          isRemoteChange.current = true;
          setCode(change.content);
        }

        if (change.version !== undefined) {
          versionRef.current = change.version;
        }
      },
    );

    // Subscribe to cursor positions
    WebSocketService.subscribe(
      `/topic/document/${documentId}/cursors`,
      (cursor) => {
        if (cursor.userId !== userId) {
          setRemoteCursors((prev) => {
            const newCursors = new Map(prev);
            newCursors.set(cursor.userId, cursor);
            return newCursors;
          });
        }
      },
    );

    // Subscribe to user presence
    WebSocketService.subscribe(
      `/topic/document/${documentId}/presence`,
      (presence) => {
        console.log("👤 Presence update:", presence);
        console.log("My username:", username);
        console.log("Presence username:", presence.username);

        // Ignore own presence updates - CHECK USERNAME INSTEAD
        if (presence.username === username) {
          console.log("✅ Filtering out own presence (matched by username)");
          return;
        }

        console.log("⚠️ Adding user:", presence.username);

        if (presence.online) {
          setActiveUsers((prev) => {
            if (prev.find((u) => u.username === presence.username)) return prev;
            return [...prev, presence];
          });
        } else {
          setActiveUsers((prev) =>
            prev.filter((u) => u.username !== presence.username),
          );
          setRemoteCursors((prev) => {
            const newCursors = new Map(prev);
            // Find and delete by username instead
            const userToDelete = Array.from(prev.entries()).find(
              ([id, cursor]) => cursor.username === presence.username,
            );
            if (userToDelete) {
              newCursors.delete(userToDelete[0]);
            }
            return newCursors;
          });
        }
      },
    );

    // Send join message
    console.log("Sending join message...");
    WebSocketService.send(`/app/document/${documentId}/join`, {
      userId,
      username,
      color: userColor,
    });

    // Cleanup on unmount
    return () => {
      console.log("Leaving document...");
      WebSocketService.send(`/app/document/${documentId}/leave`, {
        userId,
        username,
      });
    };
  }, [documentId, userId, username, userColor]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    console.log("Monaco Editor mounted");

    // Listen for content changes
    editor.onDidChangeModelContent((event) => {
      if (isRemoteChange.current) {
        isRemoteChange.current = false;
        return;
      }

      const newContent = editor.getValue();

      console.log("📤 Sending change to server");
      WebSocketService.send(`/app/document/${documentId}/change`, {
        documentId,
        userId,
        username,
        content: newContent,
        cursorPosition: 0,
        version: versionRef.current,
        timestamp: Date.now(),
      });
    });

    // Listen for cursor changes
    let cursorTimeout = null;
    editor.onDidChangeCursorPosition((event) => {
      clearTimeout(cursorTimeout);
      cursorTimeout = setTimeout(() => {
        WebSocketService.send(`/app/document/${documentId}/cursor`, {
          documentId,
          userId,
          username,
          color: userColor,
          line: event.position.lineNumber,
          column: event.position.column,
        });
      }, 100); // Debounce cursor updates
    });
  };

  // Render remote cursors
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const decorations = [];

    remoteCursors.forEach((cursor) => {
      decorations.push({
        range: new monacoRef.current.Range(
          cursor.line || 1,
          cursor.column || 1,
          cursor.line || 1,
          cursor.column || 1,
        ),
        options: {
          className: "remote-cursor",
          stickiness: 1,
          beforeContentClassName: "cursor-label",
          before: {
            content: cursor.username,
            inlineClassName: "cursor-name",
          },
          glyphMarginClassName: "cursor-glyph",
        },
      });
    });

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      decorations,
    );
  }, [remoteCursors]);

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="active-users">
          <span className="users-label">
            👥 Active Users (
            {activeUsers.filter((u) => u.userId !== userId).length + 1}):
          </span>
          <div className="user-badge" style={{ backgroundColor: userColor }}>
            {username} (You)
          </div>
          {activeUsers
            .filter((user) => user.userId !== userId) // Filter out current user
            .map((user) => (
              <div
                key={user.userId}
                className="user-badge"
                style={{ backgroundColor: user.color }}
              >
                {user.username}
              </div>
            ))}
        </div>
      </div>

      <Editor
        height="calc(100vh - 150px)"
        language={language}
        value={code}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          fontSize: 14,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          tabSize: 2,
        }}
      />
    </div>
  );
};

export default CodeEditor;
