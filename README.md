# Real-Time Chat Application

A modern, feature-rich real-time chat application built with HTML, CSS, JavaScript, and WebSockets. This application provides a smooth and interactive chat experience with multiple rooms, user authentication, and real-time messaging.

## 🚀 Features

### Core Features
- **Real-time messaging** using WebSockets
- **Multiple chat rooms** with the ability to create and join rooms
- **User authentication** with username validation
- **Responsive design** that works on desktop and mobile devices
- **Message formatting** (bold, italic, underline, links)
- **Timestamps** for all messages
- **Online user list** showing active users
- **Connection status** indicator
- **Notifications** for new messages and user activity

### User Interface
- **Modern, intuitive design** with smooth animations
- **Clean login screen** with username validation
- **Sidebar navigation** showing available rooms and online users
- **Message input** with formatting toolbar
- **Auto-scrolling** message container
- **Visual feedback** for user interactions

### Security & Validation
- **Username uniqueness** enforcement
- **Input sanitization** to prevent XSS attacks
- **Room name validation**
- **Connection error handling**
- **Graceful disconnection** handling

## 📋 Requirements

- **Node.js** (version 14.0.0 or higher)
- **npm** (comes with Node.js)
- **Modern web browser** with WebSocket support

## 🛠 Installation & Setup

### 1. Clone or Download the Project
```bash
# If using Git
git clone <repository-url>
cd chat-application

# Or download and extract the ZIP file
```

### 2. Install Dependencies
Open a terminal in the project directory and run:
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```

The server will start on `http://localhost:3000`

### 4. Open the Application
Open your web browser and navigate to:
```
http://localhost:3000
```

## 🎯 How to Use

### Getting Started
1. **Enter a username** (2-20 characters, letters, numbers, hyphens, and underscores only)
2. **Click "Join Chat"** to enter the application
3. **Select a room** from the sidebar or create a new one
4. **Start chatting!**

### Creating Rooms
1. Click the **"+"** button next to "Chat Rooms"
2. Enter a room name (2-50 characters)
3. Click **"Create Room"**
4. The new room will appear in the rooms list

### Joining Rooms
- Click on any room in the sidebar to join it
- You can switch between rooms at any time
- Each room maintains its own message history

### Message Formatting
Use the formatting toolbar above the message input:
- **B** for bold text
- **I** for italic text
- **U** for underlined text
- Multiple formats can be combined

### Keyboard Shortcuts
- **Enter**: Send message
- **Shift + Enter**: New line in message
- **Escape**: Clear message formatting

## 🏗 Project Structure

```
chat-application/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # Client-side JavaScript
├── server.js           # Node.js WebSocket server
├── package.json        # Node.js dependencies
└── README.md           # This file
```

**Enjoy your real-time chat experience!** 💬✨
