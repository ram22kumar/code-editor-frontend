import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
  }

  connect(onConnected, onError) {
    const backendUrl =
      process.env.REACT_APP_BACKEND_URL || "http://localhost:8080";
    const socket = new SockJS(`${backendUrl}/ws`);
    // const socket = new SockJS("http://localhost:8080/ws");

    this.client = new Client({
      webSocketFactory: () => socket,
      debug: (str) => console.log("STOMP:", str),
      reconnectDelay: 2000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      onConnect: () => {
        console.log("✅ WebSocket Connected");
        this.connected = true;
        if (onConnected) onConnected();
      },

      onStompError: (frame) => {
        console.error("❌ STOMP error:", frame);
        this.connected = false;
        if (onError) onError(frame);
      },

      onWebSocketClose: () => {
        console.log("🔌 WebSocket closed - will auto-reconnect");
        this.connected = false;
      },
    });

    this.client.activate();
  }

  subscribe(destination, callback) {
    if (!this.client || !this.connected) {
      console.error("WebSocket not connected");
      return null;
    }

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const body = JSON.parse(message.body);
        callback(body);
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    });

    this.subscriptions.set(destination, subscription);
    return subscription;
  }

  subscribeToUser(userId, destination, callback) {
    return this.subscribe(`/user/${userId}${destination}`, callback);
  }

  send(destination, body) {
    if (!this.client || !this.connected) {
      console.error("WebSocket not connected");
      return;
    }

    this.client.publish({
      destination,
      body: JSON.stringify(body),
    });
  }

  disconnect() {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions.clear();
    if (this.client) {
      this.client.deactivate();
    }
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}

const webSocketServiceInstance = new WebSocketService();
export default webSocketServiceInstance;
