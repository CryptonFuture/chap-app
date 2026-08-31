import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext()

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token')
      const newSocket = io('https://backend-nine-psi-25.vercel.app', {
        auth: { token }
      })

      newSocket.on('connect', () => {
        console.log('Socket connected')
      })

      newSocket.on('onlineUsers', (users) => {
        setOnlineUsers(users)
      })

      newSocket.on('userOnline', ({ userId }) => {
        setOnlineUsers(prev => prev.includes(userId) ? prev : [...prev, userId])
      })

      newSocket.on('userOffline', ({ userId }) => {
        setOnlineUsers(prev => prev.filter(id => id !== userId))
      })

      setSocket(newSocket)

      return () => {
        newSocket.disconnect()
      }
    } else {
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
    }
  }, [user])

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
