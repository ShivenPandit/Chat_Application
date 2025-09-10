// Chat Application JavaScript
class ChatApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.rooms = new Map();
        this.users = new Set();
        this.messages = new Map();
        this.isConnected = false;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeFormatting();
    }

    initializeElements() {
        // Login elements
        this.loginScreen = document.getElementById('loginScreen');
        this.loginForm = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('usernameInput');
        this.usernameError = document.getElementById('usernameError');

        // Chat interface elements
        this.chatInterface = document.getElementById('chatInterface');
        this.currentUsername = document.getElementById('currentUsername');
        this.userInitial = document.getElementById('userInitial');
        this.logoutBtn = document.getElementById('logoutBtn');

        // Room elements
        this.roomsList = document.getElementById('roomsList');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.currentRoomName = document.getElementById('currentRoomName');
        this.roomUserCount = document.getElementById('roomUserCount');

        // Message elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');

        // Modal elements
        this.createRoomModal = document.getElementById('createRoomModal');
        this.createRoomForm = document.getElementById('createRoomForm');
        this.roomNameInput = document.getElementById('roomNameInput');
        this.roomNameError = document.getElementById('roomNameError');
        this.cancelCreateRoom = document.getElementById('cancelCreateRoom');

        // Other elements
        this.usersList = document.getElementById('usersList');
        this.notificationContainer = document.getElementById('notificationContainer');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.statusIndicator = this.connectionStatus.querySelector('.status-indicator');
        this.statusText = this.connectionStatus.querySelector('.status-text');
    }

    bindEvents() {
        // Login form
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));

        // Logout
        this.logoutBtn.addEventListener('click', () => this.handleLogout());

        // Room creation
        this.createRoomBtn.addEventListener('click', () => this.showCreateRoomModal());
        this.createRoomForm.addEventListener('submit', (e) => this.handleCreateRoom(e));
        this.cancelCreateRoom.addEventListener('click', () => this.hideCreateRoomModal());

        // Modal close
        this.createRoomModal.addEventListener('click', (e) => {
            if (e.target === this.createRoomModal) {
                this.hideCreateRoomModal();
            }
        });
        
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.hideCreateRoomModal();
        });

        // Message sending
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });

        // Window events
        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.socket.close();
            }
        });
    }

    initializeFormatting() {
        this.formatButtons = document.querySelectorAll('.format-btn');
        this.selectedFormats = new Set();

        this.formatButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                if (this.selectedFormats.has(format)) {
                    this.selectedFormats.delete(format);
                    btn.classList.remove('active');
                } else {
                    this.selectedFormats.add(format);
                    btn.classList.add('active');
                }
            });
        });
    }

    // WebSocket Connection
    connectToServer() {
        try {
            // For local development, use ws://localhost:3000
            // In production, you would use wss:// for secure connections
            this.socket = new WebSocket('ws://localhost:3000');
            
            this.updateConnectionStatus('connecting', 'Connecting...');

            this.socket.onopen = () => {
                console.log('Connected to server');
                this.isConnected = true;
                this.updateConnectionStatus('connected', 'Connected');
                this.joinChat();
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            };

            this.socket.onclose = () => {
                console.log('Disconnected from server');
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', 'Disconnected');
                this.showNotification('Connection lost. Trying to reconnect...', 'error');
                
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (!this.isConnected && this.currentUser) {
                        this.connectToServer();
                    }
                }, 3000);
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('disconnected', 'Connection Error');
                this.showNotification('Failed to connect to server. Please check if the server is running.', 'error');
            };

        } catch (error) {
            console.error('Failed to connect:', error);
            this.showNotification('Failed to connect to server. Please check if the server is running on localhost:3000', 'error');
        }
    }

    updateConnectionStatus(status, text) {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = text;
    }

    // Message Handlers
    handleServerMessage(data) {
        switch (data.type) {
            case 'userJoined':
                this.handleUserJoined(data);
                break;
            case 'userLeft':
                this.handleUserLeft(data);
                break;
            case 'roomsList':
                this.updateRoomsList(data.rooms);
                break;
            case 'usersList':
                this.updateUsersList(data.users);
                break;
            case 'message':
                this.displayMessage(data);
                break;
            case 'roomCreated':
                this.handleRoomCreated(data);
                break;
            case 'joinedRoom':
                this.handleJoinedRoom(data);
                break;
            case 'error':
                this.showNotification(data.message, 'error');
                break;
            case 'notification':
                this.showNotification(data.message, data.level || 'info');
                break;
        }
    }

    handleUserJoined(data) {
        this.users.add(data.username);
        this.updateUsersList(Array.from(this.users));
        if (data.username !== this.currentUser.username) {
            this.showNotification(`${data.username} joined the chat`, 'success');
        }
    }

    handleUserLeft(data) {
        this.users.delete(data.username);
        this.updateUsersList(Array.from(this.users));
        this.showNotification(`${data.username} left the chat`, 'warning');
    }

    handleRoomCreated(data) {
        this.showNotification(`Room "${data.room.name}" created successfully`, 'success');
        this.hideCreateRoomModal();
        this.roomNameInput.value = '';
    }

    handleJoinedRoom(data) {
        this.currentRoom = data.room;
        this.currentRoomName.textContent = data.room.name;
        this.roomUserCount.textContent = `${data.room.users.length} users`;
        
        // Clear previous messages
        this.messagesContainer.innerHTML = '';
        
        // Load room messages if any
        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(message => this.displayMessage(message));
        }
        
        // Enable message input
        this.messageInput.disabled = false;
        this.sendBtn.disabled = false;
        this.messageInput.placeholder = `Type a message in ${data.room.name}...`;
        
        // Update room selection in sidebar
        this.updateRoomSelection(data.room.id);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    // Login/Logout
    handleLogin(e) {
        e.preventDefault();
        const username = this.usernameInput.value.trim();
        
        if (!this.validateUsername(username)) {
            return;
        }

        this.currentUser = {
            username: username,
            id: this.generateUserId()
        };

        this.currentUsername.textContent = username;
        this.userInitial.textContent = username.charAt(0).toUpperCase();
        
        this.loginScreen.classList.add('hidden');
        this.chatInterface.classList.remove('hidden');
        
        this.connectToServer();
    }

    validateUsername(username) {
        this.usernameError.textContent = '';
        
        if (!username) {
            this.usernameError.textContent = 'Please enter a username';
            return false;
        }
        
        if (username.length < 2) {
            this.usernameError.textContent = 'Username must be at least 2 characters';
            return false;
        }
        
        if (username.length > 20) {
            this.usernameError.textContent = 'Username must be less than 20 characters';
            return false;
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            this.usernameError.textContent = 'Username can only contain letters, numbers, hyphens, and underscores';
            return false;
        }
        
        return true;
    }

    handleLogout() {
        if (this.socket) {
            this.socket.close();
        }
        
        this.currentUser = null;
        this.currentRoom = null;
        this.rooms.clear();
        this.users.clear();
        this.messages.clear();
        
        this.chatInterface.classList.add('hidden');
        this.loginScreen.classList.remove('hidden');
        
        this.usernameInput.value = '';
        this.messageInput.value = '';
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
        
        this.updateConnectionStatus('disconnected', 'Disconnected');
    }

    joinChat() {
        if (this.socket && this.currentUser) {
            this.socket.send(JSON.stringify({
                type: 'join',
                username: this.currentUser.username,
                userId: this.currentUser.id
            }));
        }
    }

    // Room Management
    showCreateRoomModal() {
        this.createRoomModal.classList.remove('hidden');
        this.roomNameInput.focus();
    }

    hideCreateRoomModal() {
        this.createRoomModal.classList.add('hidden');
        this.roomNameError.textContent = '';
    }

    handleCreateRoom(e) {
        e.preventDefault();
        const roomName = this.roomNameInput.value.trim();
        
        if (!this.validateRoomName(roomName)) {
            return;
        }

        if (this.socket && this.isConnected) {
            this.socket.send(JSON.stringify({
                type: 'createRoom',
                roomName: roomName
            }));
        }
    }

    validateRoomName(roomName) {
        this.roomNameError.textContent = '';
        
        if (!roomName) {
            this.roomNameError.textContent = 'Please enter a room name';
            return false;
        }
        
        if (roomName.length < 2) {
            this.roomNameError.textContent = 'Room name must be at least 2 characters';
            return false;
        }
        
        if (roomName.length > 50) {
            this.roomNameError.textContent = 'Room name must be less than 50 characters';
            return false;
        }
        
        return true;
    }

    joinRoom(roomId) {
        if (this.socket && this.isConnected) {
            this.socket.send(JSON.stringify({
                type: 'joinRoom',
                roomId: roomId
            }));
        }
    }

    updateRoomsList(rooms) {
        this.roomsList.innerHTML = '';
        
        rooms.forEach(room => {
            const roomElement = document.createElement('li');
            roomElement.className = 'room-item';
            roomElement.dataset.roomId = room.id;
            
            roomElement.innerHTML = `
                <div class="room-name">${this.escapeHtml(room.name)}</div>
                <div class="room-user-count">${room.users.length} users</div>
            `;
            
            roomElement.addEventListener('click', () => {
                this.joinRoom(room.id);
            });
            
            this.roomsList.appendChild(roomElement);
            this.rooms.set(room.id, room);
        });
    }

    updateRoomSelection(roomId) {
        const roomItems = this.roomsList.querySelectorAll('.room-item');
        roomItems.forEach(item => {
            if (item.dataset.roomId === roomId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    updateUsersList(users) {
        this.usersList.innerHTML = '';
        
        users.forEach(username => {
            const userElement = document.createElement('li');
            userElement.className = 'user-item';
            userElement.textContent = username;
            this.usersList.appendChild(userElement);
        });
        
        this.users = new Set(users);
    }

    // Message Handling
    sendMessage() {
        const text = this.messageInput.value.trim();
        
        if (!text || !this.currentRoom || !this.socket || !this.isConnected) {
            return;
        }

        const formattedText = this.applyFormatting(text);
        
        this.socket.send(JSON.stringify({
            type: 'message',
            roomId: this.currentRoom.id,
            text: formattedText,
            timestamp: Date.now()
        }));

        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.clearFormatting();
    }

    applyFormatting(text) {
        let formattedText = text;
        
        if (this.selectedFormats.has('bold')) {
            formattedText = `**${formattedText}**`;
        }
        
        if (this.selectedFormats.has('italic')) {
            formattedText = `*${formattedText}*`;
        }
        
        if (this.selectedFormats.has('underline')) {
            formattedText = `__${formattedText}__`;
        }
        
        return formattedText;
    }

    clearFormatting() {
        this.selectedFormats.clear();
        this.formatButtons.forEach(btn => btn.classList.remove('active'));
    }

    displayMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.username === this.currentUser?.username ? 'own' : ''}`;
        
        const avatar = message.username.charAt(0).toUpperCase();
        const time = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const formattedText = this.formatMessageText(message.text);
        
        messageElement.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${this.escapeHtml(message.username)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${formattedText}</div>
            </div>
        `;
        
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        // Show notification for new messages when not focused
        if (message.username !== this.currentUser?.username && !document.hasFocus()) {
            this.showNotification(`New message from ${message.username}`, 'info');
        }
    }

    formatMessageText(text) {
        // Convert markdown-like formatting to HTML
        let formatted = this.escapeHtml(text);
        
        // Bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Underline
        formatted = formatted.replace(/__(.*?)__/g, '<u>$1</u>');
        
        // Links (basic URL detection)
        formatted = formatted.replace(
            /(https?:\/\/[^\s]+)/g, 
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        
        // Convert newlines to <br>
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    // Utility Methods
    generateUserId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        this.notificationContainer.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
        
        // Also remove on click
        notification.addEventListener('click', () => {
            notification.remove();
        });
    }
}

// Initialize the chat application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});

// Handle page visibility for notifications
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // User switched away from the tab
    } else {
        // User came back to the tab
    }
});
