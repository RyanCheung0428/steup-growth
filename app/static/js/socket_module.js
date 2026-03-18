/**
 * WebSocket Module for Real-time Chat Communication
 * 
 * This module handles WebSocket connections using Socket.IO for real-time messaging.
 * It integrates with JWT authentication and provides event handlers for chat functionality.
 */

class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.currentRoom = null;
        this.messageHandlers = [];
        this.eventHandlers = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.idleTimeoutMs = 60 * 60 * 1000;
        this.lastUserActivityAt = 0;
        this.idleCheckTimer = null;
        this.activityEmitThrottleMs = 15000;
        this.lastActivityEmitAt = 0;
        this.userInteractionListener = this.handleUserInteraction.bind(this);
        this.refreshRequired = false;
    }

    /**
     * Initialize WebSocket connection with JWT authentication
     * @param {string} token - JWT access token
     * @returns {Promise} - Resolves when connected
     */
    connect(token) {
        return new Promise((resolve, reject) => {
            try {
                if (this.refreshRequired) {
                    reject(new Error('Connection disabled. Please refresh the page to reconnect.'));
                    return;
                }

                if (this.socket && this.socket.connected) {
                    resolve({ status: 'success', message: 'Already connected' });
                    return;
                }

                // Initialize Socket.IO connection with auth
                this.socket = io({
                    auth: {
                        token: token
                    },
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    reconnectionAttempts: this.maxReconnectAttempts
                });

                // Connection successful
                this.socket.on('connect', () => {
                    console.log('✅ WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.refreshRequired = false;
                    this.touchUserActivity();
                    this.startIdleMonitoring();
                    
                    // Trigger custom connect handlers
                    this.trigger('connect');
                });

                // Server confirmed connection
                this.socket.on('connected', (data) => {
                    console.log('✅ Server confirmed connection:', data);
                    resolve(data);
                });

                // Connection error
                this.socket.on('connect_error', (error) => {
                    console.error('❌ WebSocket connection error:', error.message);
                    this.isConnected = false;
                    this.reconnectAttempts++;
                    
                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        this.lockUntilRefresh('Max reconnection attempts reached. Please refresh the page.');
                        reject(new Error('Failed to connect after multiple attempts'));
                    }
                    
                    this.trigger('connect_error', error);
                });

                // Disconnection
                this.socket.on('disconnect', (reason) => {
                    console.log('🔌 WebSocket disconnected:', reason);
                    this.isConnected = false;
                    this.currentRoom = null;

                    // Stop automatic retries after inactivity timeout or server forced disconnect.
                    if (reason === 'io server disconnect') {
                        this.lockUntilRefresh('Disconnected by server. Please refresh the page to reconnect.');
                    }

                    this.trigger('disconnect', reason);
                });

                // Reconnection attempt
                this.socket.on('reconnect_attempt', (attemptNumber) => {
                    console.log(`🔄 Reconnection attempt #${attemptNumber}`);
                    this.trigger('reconnect_attempt', attemptNumber);
                });

                // Reconnection success
                this.socket.on('reconnect', (attemptNumber) => {
                    console.log(`✅ Reconnected after ${attemptNumber} attempts`);
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    // Rejoin room if previously in one
                    if (this.currentRoom) {
                        this.joinRoom(this.currentRoom);
                    }
                    
                    this.trigger('reconnect', attemptNumber);
                });

                // Error handling
                this.socket.on('error', (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.trigger('error', error);
                });

                this.socket.on('idle_timeout', (data) => {
                    const message = data && data.message
                        ? data.message
                        : 'Connection closed due to inactivity. Please refresh the page to reconnect.';
                    this.lockUntilRefresh(message);
                    this.trigger('idle_timeout', data || { message: message });
                });

                // Setup message event handlers
                this.setupMessageHandlers();

            } catch (error) {
                console.error('❌ Failed to initialize WebSocket:', error);
                reject(error);
            }
        });
    }

    /**
     * Setup handlers for incoming messages and events
     */
    setupMessageHandlers() {
        if (!this.socket) return;

        // Room joined successfully
        this.socket.on('joined_room', (data) => {
            console.log('🚪 Joined room:', data);
            this.currentRoom = data.conversation_id;
            this.touchUserActivity();
            this.trigger('joined_room', data);
        });

        // Left room
        this.socket.on('left_room', (data) => {
            console.log('🚪 Left room:', data);
            this.currentRoom = null;
            this.touchUserActivity();
            this.trigger('left_room', data);
        });

        // New message received
        this.socket.on('new_message', (data) => {
            console.log('💬 New message:', data);
            this.trigger('new_message', data);
        });

        // AI is thinking/processing
        this.socket.on('ai_thinking', (data) => {
            console.log('🤔 AI is thinking...');
            this.trigger('ai_thinking', data);
        });

        // AI response chunk (streaming)
        this.socket.on('ai_response_chunk', (data) => {
            this.trigger('ai_response_chunk', data);
        });

        // AI response complete
        this.socket.on('ai_response_complete', (data) => {
            console.log('✅ AI response complete');
            this.trigger('ai_response_complete', data);
        });

        // AI response error
        this.socket.on('ai_response_error', (data) => {
            console.error('❌ AI response error:', data);
            this.trigger('ai_response_error', data);
        });

        // File uploaded
        this.socket.on('file_uploaded', (data) => {
            console.log('📁 File uploaded:', data);
            this.trigger('file_uploaded', data);
        });

        // User typing indicator
        this.socket.on('user_typing', (data) => {
            this.trigger('user_typing', data);
        });
    }

    /**
     * Join a conversation room
     * @param {number} conversationId - Conversation ID to join
     */
    joinRoom(conversationId) {
        if (!this.socket || !this.isConnected) {
            console.error('❌ Cannot join room: Not connected');
            return;
        }

        console.log(`🚪 Joining room: conversation_${conversationId}`);
        this.socket.emit('join_room', { conversation_id: conversationId });
    }

    /**
     * Leave current room
     * @param {number} conversationId - Conversation ID to leave
     */
    leaveRoom(conversationId) {
        if (!this.socket || !this.isConnected) {
            console.error('❌ Cannot leave room: Not connected');
            return;
        }

        console.log(`🚪 Leaving room: conversation_${conversationId}`);
        this.socket.emit('leave_room', { conversation_id: conversationId });
    }

    /**
     * Send a text message
     * @param {string} message - Message text
     * @param {number} conversationId - Conversation ID
     * @param {number} userId - User ID
     */
    sendMessage(message, conversationId, userId) {
        if (!this.socket || !this.isConnected) {
            console.error('❌ Cannot send message: Not connected');
            return Promise.reject(new Error('Not connected to WebSocket'));
        }

        console.log('📤 Sending message:', { message, conversationId, userId });
        this.touchUserActivity();
        
        this.socket.emit('send_message', {
            message: message,
            conversation_id: conversationId,
            user_id: userId
        });

        return Promise.resolve();
    }

    /**
     * Send typing indicator
     * @param {number} conversationId - Conversation ID
     * @param {number} userId - User ID
     * @param {boolean} isTyping - Whether user is typing
     */
    sendTypingIndicator(conversationId, userId, isTyping) {
        if (!this.socket || !this.isConnected) return;

        this.touchUserActivity();

        this.socket.emit('typing', {
            conversation_id: conversationId,
            user_id: userId,
            is_typing: isTyping
        });
    }

    /**
     * Register event handler
     * @param {string} event - Event name
     * @param {function} handler - Handler function
     */
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    /**
     * Unregister event handler
     * @param {string} event - Event name
     * @param {function} handler - Handler function to remove
     */
    off(event, handler) {
        if (!this.eventHandlers[event]) return;

        if (handler) {
            this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
        } else {
            this.eventHandlers[event] = [];
        }
    }

    /**
     * Trigger custom event handlers
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    trigger(event, data) {
        if (!this.eventHandlers[event]) return;

        this.eventHandlers[event].forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`Error in ${event} handler:`, error);
            }
        });
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        if (this.socket) {
            console.log('🔌 Disconnecting WebSocket...');
            this.stopIdleMonitoring();
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.currentRoom = null;
        }
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    connected() {
        return this.isConnected && this.socket && this.socket.connected;
    }

    startIdleMonitoring() {
        if (this.idleCheckTimer) {
            clearInterval(this.idleCheckTimer);
        }

        this.lastUserActivityAt = Date.now();
        this.attachUserInteractionListeners();

        this.idleCheckTimer = window.setInterval(() => {
            if (!this.connected()) {
                return;
            }

            const idleFor = Date.now() - this.lastUserActivityAt;
            if (idleFor >= this.idleTimeoutMs) {
                this.lockUntilRefresh('Connection closed due to inactivity. Please refresh the page to reconnect.');
                this.trigger('idle_timeout', {
                    message: 'Connection closed due to inactivity. Please refresh the page to reconnect.'
                });
            }
        }, 30000);
    }

    stopIdleMonitoring() {
        if (this.idleCheckTimer) {
            clearInterval(this.idleCheckTimer);
            this.idleCheckTimer = null;
        }
        this.detachUserInteractionListeners();
    }

    handleUserInteraction() {
        this.touchUserActivity();
    }

    touchUserActivity() {
        this.lastUserActivityAt = Date.now();

        if (!this.socket || !this.socket.connected) {
            return;
        }

        const now = Date.now();
        if ((now - this.lastActivityEmitAt) >= this.activityEmitThrottleMs) {
            this.lastActivityEmitAt = now;
            this.socket.emit('client_activity', { at: now });
        }
    }

    attachUserInteractionListeners() {
        const events = ['click', 'keydown', 'input', 'scroll', 'touchstart', 'pointerdown'];
        events.forEach((eventName) => {
            window.addEventListener(eventName, this.userInteractionListener, { passive: true });
        });
    }

    detachUserInteractionListeners() {
        const events = ['click', 'keydown', 'input', 'scroll', 'touchstart', 'pointerdown'];
        events.forEach((eventName) => {
            window.removeEventListener(eventName, this.userInteractionListener);
        });
    }

    lockUntilRefresh(message) {
        this.refreshRequired = true;

        if (this.socket) {
            this.socket.io.opts.reconnection = false;
        }

        this.stopIdleMonitoring();
        this.disconnect();
        this.trigger('refresh_required', { message: message });
    }
}

// Create singleton instance
const socketManager = new SocketManager();

// Export for use in other modules
window.socketManager = socketManager;

window.addEventListener('beforeunload', () => {
    socketManager.disconnect();
});
