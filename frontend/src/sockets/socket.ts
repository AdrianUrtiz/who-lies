import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

class SocketService {
  private socket: Socket | null = null

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      this.socket.on('connect', () => {
        console.log('✅ Connected to server')
      })

      this.socket.on('disconnect', () => {
        console.log('❌ Disconnected from server')
      })

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error)
      })
    }
    return this.socket
  }

  getSocket() {
    if (!this.socket) {
      return this.connect()
    }
    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
}

export const socketService = new SocketService()
