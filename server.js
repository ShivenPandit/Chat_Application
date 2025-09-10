const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

class ChatServer {
    constructor(port = 3000) {
        this.port = port;
        this.clients = new Map(); // Map of WebSocket connections to user data
        this.rooms = new Map(); // Map of room IDs to room data
        this.users = new Map(); // Map of user IDs to user data
        
        this.initializeDefaultRooms();
        this.createServer();
    }

    initializeDefaultRooms() {
        // Create default rooms
        const defaultRooms = [
            { name: 'General', description: 'General discussion' },
            { name: 'Random', description: 'Random conversations' },
            { name: 'Help', description: 'Get help and support' }
        ];

        defaultRooms.forEach(roomData => {
            const room = this.createRoom(roomData.name, roomData.description);
            console.log(`Created default room: ${room.name} (${room.id})`);
        });
    }

    createServer() {
        // Create HTTP server for serving static files
        const server = http.createServer((req, res) => {
            this.handleHttpRequest(req, res);
        });

        // Create WebSocket server
        this.wss = new WebSocket.Server({ server });
        
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection from:', req.socket.remoteAddress);
            this.handleConnection(ws);
        });

        server.listen(this.port, () => {
            console.log(`Chat server running on http://localhost:${this.port}`);
            console.log(`WebSocket server running on ws://localhost:${this.port}`);
        });
    }

    handleHttpRequest(req, res) {
        // Serve static files
        let filePath = req.url === '/' ? '/index.html' : req.url;
        const fullPath = path.join(__dirname, filePath);
        
        // Security check - prevent directory traversal
        if (!fullPath.startsWith(__dirname)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        fs.readFile(fullPath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    res.writeHead(500);
                    res.end('Server error');
                }
                return;
            }

            // Set content type based on file extension
            const ext = path.extname(filePath);
            const contentTypes = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'text/javascript',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.gif': 'image/gif',
                '.ico': 'image/x-icon'
            };

            const contentType = contentTypes[ext] || 'text/plain';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
    }

    handleConnection(ws) {
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                this.handleMessage(ws, data);
            } catch (error) {
                console.error('Invalid JSON message:', error);
                this.sendError(ws, 'Invalid message format');
            }
        });

        ws.on('close', () => {
            this.handleDisconnection(ws);
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.handleDisconnection(ws);
        });
    }

    handleMessage(ws, data) {
        console.log('Received message:', data.type);

        switch (data.type) {
            case 'join':
                this.handleUserJoin(ws, data);
                break;
            case 'createRoom':
                this.handleCreateRoom(ws, data);
                break;
            case 'joinRoom':
                this.handleJoinRoom(ws, data);
                break;
            case 'message':
                this.handleChatMessage(ws, data);
                break;
            default:
                this.sendError(ws, 'Unknown message type');
        }
    }

    handleUserJoin(ws, data) {
        // Validate username
        if (!data.username || typeof data.username !== 'string') {
            this.sendError(ws, 'Invalid username');
            return;
        }

        const username = data.username.trim();
        if (username.length < 2 || username.length > 20) {
            this.sendError(ws, 'Username must be between 2 and 20 characters');
            return;
        }

        // Check if username is already taken
        for (const [clientWs, clientData] of this.clients) {
            if (clientData.username === username && clientWs !== ws) {
                this.sendError(ws, 'Username is already taken');
                return;
            }
        }

        // Create user data
        const user = {
            id: data.userId || this.generateId(),
            username: username,
            joinedAt: new Date(),
            currentRoom: null
        };

        // Store client connection
        this.clients.set(ws, user);
        this.users.set(user.id, user);

        console.log(`User joined: ${user.username} (${user.id})`);

        // Send rooms list to the new user
        this.sendRoomsList(ws);

        // Broadcast user joined to other clients
        this.broadcast({
            type: 'userJoined',
            username: user.username,
            userId: user.id
        }, ws);

        // Send updated users list to all clients
        this.broadcastUsersList();
    }

    handleCreateRoom(ws, data) {
        const user = this.clients.get(ws);
        if (!user) {
            this.sendError(ws, 'User not authenticated');
            return;
        }

        const roomName = data.roomName?.trim();
        if (!roomName || roomName.length < 2 || roomName.length > 50) {
            this.sendError(ws, 'Room name must be between 2 and 50 characters');
            return;
        }

        // Check if room name already exists
        for (const room of this.rooms.values()) {
            if (room.name.toLowerCase() === roomName.toLowerCase()) {
                this.sendError(ws, 'Room name already exists');
                return;
            }
        }

        const room = this.createRoom(roomName, `Created by ${user.username}`);
        console.log(`Room created: ${room.name} by ${user.username}`);

        // Send success message to creator
        this.send(ws, {
            type: 'roomCreated',
            room: this.serializeRoom(room)
        });

        // Broadcast updated rooms list to all clients
        this.broadcastRoomsList();
    }

    handleJoinRoom(ws, data) {
        const user = this.clients.get(ws);
        if (!user) {
            this.sendError(ws, 'User not authenticated');
            return;
        }

        const room = this.rooms.get(data.roomId);
        if (!room) {
            this.sendError(ws, 'Room not found');
            return;
        }

        // Remove user from current room
        if (user.currentRoom) {
            const currentRoom = this.rooms.get(user.currentRoom);
            if (currentRoom) {
                currentRoom.users.delete(user.id);
                currentRoom.connections.delete(ws);
            }
        }

        // Add user to new room
        room.users.add(user.id);
        room.connections.add(ws);
        user.currentRoom = room.id;

        console.log(`User ${user.username} joined room: ${room.name}`);

        // Send room data and recent messages to the user
        this.send(ws, {
            type: 'joinedRoom',
            room: this.serializeRoom(room),
            messages: this.getRecentMessages(room.id)
        });

        // Broadcast updated rooms list
        this.broadcastRoomsList();

        // Notify other users in the room
        this.broadcastToRoom(room.id, {
            type: 'userJoinedRoom',
            username: user.username,
            roomId: room.id
        }, ws);
    }

    handleChatMessage(ws, data) {
        const user = this.clients.get(ws);
        if (!user) {
            this.sendError(ws, 'User not authenticated');
            return;
        }

        const room = this.rooms.get(data.roomId);
        if (!room) {
            this.sendError(ws, 'Room not found');
            return;
        }

        if (!room.users.has(user.id)) {
            this.sendError(ws, 'User not in room');
            return;
        }

        const message = {
            id: this.generateId(),
            username: user.username,
            userId: user.id,
            text: data.text.trim(),
            timestamp: Date.now(),
            roomId: room.id
        };

        if (!message.text) {
            this.sendError(ws, 'Message cannot be empty');
            return;
        }

        // Store message
        room.messages.push(message);

        // Keep only last 100 messages per room
        if (room.messages.length > 100) {
            room.messages = room.messages.slice(-100);
        }

        console.log(`Message in ${room.name} from ${user.username}: ${message.text}`);

        // Broadcast message to all users in the room
        this.broadcastToRoom(room.id, {
            type: 'message',
            ...message
        });
    }

    handleDisconnection(ws) {
        const user = this.clients.get(ws);
        if (!user) return;

        console.log(`User disconnected: ${user.username} (${user.id})`);

        // Remove user from current room
        if (user.currentRoom) {
            const room = this.rooms.get(user.currentRoom);
            if (room) {
                room.users.delete(user.id);
                room.connections.delete(ws);
            }
        }

        // Remove from collections
        this.clients.delete(ws);
        this.users.delete(user.id);

        // Broadcast user left to other clients
        this.broadcast({
            type: 'userLeft',
            username: user.username,
            userId: user.id
        }, ws);

        // Send updated users list
        this.broadcastUsersList();

        // Send updated rooms list
        this.broadcastRoomsList();
    }

    createRoom(name, description = '') {
        const room = {
            id: this.generateId(),
            name: name,
            description: description,
            users: new Set(),
            connections: new Set(),
            messages: [],
            createdAt: new Date()
        };

        this.rooms.set(room.id, room);
        return room;
    }

    serializeRoom(room) {
        return {
            id: room.id,
            name: room.name,
            description: room.description,
            users: Array.from(room.users).map(userId => {
                const user = this.users.get(userId);
                return user ? user.username : null;
            }).filter(Boolean),
            userCount: room.users.size,
            createdAt: room.createdAt
        };
    }

    getRecentMessages(roomId, limit = 50) {
        const room = this.rooms.get(roomId);
        if (!room) return [];

        return room.messages.slice(-limit);
    }

    send(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    sendError(ws, message) {
        this.send(ws, {
            type: 'error',
            message: message
        });
    }

    broadcast(data, excludeWs = null) {
        for (const [ws, user] of this.clients) {
            if (ws !== excludeWs) {
                this.send(ws, data);
            }
        }
    }

    broadcastToRoom(roomId, data, excludeWs = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        for (const ws of room.connections) {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                this.send(ws, data);
            }
        }
    }

    sendRoomsList(ws) {
        const rooms = Array.from(this.rooms.values()).map(room => this.serializeRoom(room));
        this.send(ws, {
            type: 'roomsList',
            rooms: rooms
        });
    }

    broadcastRoomsList() {
        const rooms = Array.from(this.rooms.values()).map(room => this.serializeRoom(room));
        this.broadcast({
            type: 'roomsList',
            rooms: rooms
        });
    }

    broadcastUsersList() {
        const users = Array.from(this.users.values()).map(user => user.username);
        this.broadcast({
            type: 'usersList',
            users: users
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Start the server
const server = new ChatServer();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.wss.close(() => {
        console.log('Server shut down successfully');
        process.exit(0);
    });
});

module.exports = ChatServer;
