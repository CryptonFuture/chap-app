import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import api from '../services/api'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import CreateGroupModal from '../components/CreateGroupModal'
import './Chat.css'

export default function Chat() {
  const { user, logout } = useAuth()
  const { socket, onlineUsers } = useSocket()
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [selected, setSelected] = useState({ type: 'public', data: null })
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [typingUser, setTypingUser] = useState(null)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [roomModalMode, setRoomModalMode] = useState('create')

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, groupsRes] = await Promise.all([
          api.get('/users'),
          api.get('/groups')
        ])
        setUsers(usersRes.data)
        setGroups(groupsRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!user) return
    const fetchMessages = async () => {
      try {
        if (selected.type === 'public') {
          const res = await api.get('/messages/public')
          setMessages(res.data)
        } else if (selected.type === 'private' && selected.data) {
          const res = await api.get(`/messages/private/${selected.data._id}`)
          setMessages(res.data)
          await api.put(`/messages/read/${selected.data._id}`)
        } else if (selected.type === 'group' && selected.data) {
          const res = await api.get(`/messages/group/${selected.data._id}`)
          setMessages(res.data)
        }
      } catch (err) {
        console.error(err)
        setMessages([])
      }
    }
    fetchMessages()
  }, [selected, user])

  useEffect(() => {
    if (!socket) return

    const handlePublic = (msg) => {
      if (selected.type === 'public') setMessages(prev => [...prev, msg])
    }
    const handlePrivate = (msg) => {
      if (
        selected.type === 'private' && selected.data &&
        ((msg.sender._id === selected.data._id || msg.sender._id === user._id) &&
         (msg.receiver?._id === selected.data._id || msg.receiver?._id === user._id))
      ) {
        setMessages(prev => [...prev, msg])
      }
    }
    const handleGroup = (msg) => {
      const gid = msg.group?._id || msg.group
      if (selected.type === 'group' && selected.data && gid === selected.data._id) {
        setMessages(prev => [...prev, msg])
      }
    }
    const handleTyping = (data) => {
      if (data.groupId && selected.type === 'group' && selected.data?._id === data.groupId) {
        setTypingUser(data.username)
      } else if (data.isPublic && selected.type === 'public') {
        setTypingUser(data.username)
      } else if (!data.isPublic && !data.groupId && selected.type === 'private' && selected.data?._id === data.userId) {
        setTypingUser(data.username)
      }
    }
    const handleStopTyping = () => setTypingUser(null)
    const handleUserOnline = ({ userId }) => {
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isOnline: true } : u))
    }
    const handleUserOffline = ({ userId }) => {
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isOnline: false } : u))
    }

    socket.on('newPublicMessage', handlePublic)
    socket.on('newPrivateMessage', handlePrivate)
    socket.on('newGroupMessage', handleGroup)
    socket.on('userTyping', handleTyping)
    socket.on('userStopTyping', handleStopTyping)
    socket.on('userOnline', handleUserOnline)
    socket.on('userOffline', handleUserOffline)

    return () => {
      socket.off('newPublicMessage', handlePublic)
      socket.off('newPrivateMessage', handlePrivate)
      socket.off('newGroupMessage', handleGroup)
      socket.off('userTyping', handleTyping)
      socket.off('userStopTyping', handleStopTyping)
      socket.off('userOnline', handleUserOnline)
      socket.off('userOffline', handleUserOffline)
    }
  }, [socket, selected, user])

  const sendMessage = async (payload) => {
    if (!socket) return
    let fileData = null
    if (payload.file) {
      const formData = new FormData()
      formData.append('file', payload.file)
      try {
        const res = await api.post('/messages/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        fileData = res.data
      } catch (err) {
        console.error('Upload failed', err)
        return
      }
    }

    const data = {
      content: payload.content || '',
      messageType: fileData?.messageType || 'text',
      fileUrl: fileData?.fileUrl || null,
      fileName: fileData?.fileName || null,
      fileSize: fileData?.fileSize || null
    }

    if (selected.type === 'public') {
      socket.emit('sendPublicMessage', data)
    } else if (selected.type === 'private' && selected.data) {
      socket.emit('sendPrivateMessage', { ...data, receiverId: selected.data._id })
    } else if (selected.type === 'group' && selected.data) {
      socket.emit('sendGroupMessage', { ...data, groupId: selected.data._id })
    }
  }

  const handleTyping = () => {
    if (!socket) return
    const data = {}
    if (selected.type === 'group' && selected.data) data.groupId = selected.data._id
    else if (selected.type === 'private' && selected.data) data.receiverId = selected.data._id
    socket.emit('typing', data)
  }

  const handleStopTyping = () => {
    if (!socket) return
    const data = {}
    if (selected.type === 'group' && selected.data) data.groupId = selected.data._id
    else if (selected.type === 'private' && selected.data) data.receiverId = selected.data._id
    socket.emit('stopTyping', data)
  }

  const handleRoomCreated = (group) => {
    setGroups(prev => {
      const exists = prev.find(g => g._id === group._id)
      if (exists) return prev.map(g => g._id === group._id ? group : g)
      return [group, ...prev]
    })
    setSelected({ type: 'group', data: group })
    if (socket) socket.emit('joinGroup', group._id)
    setShowRoomModal(false)
  }

  return (
    <div className="chat-layout">
      <Sidebar
        users={users}
        groups={groups}
        onlineUsers={onlineUsers}
        selected={selected}
        onSelect={setSelected}
        currentUser={user}
        onLogout={logout}
        loading={loading}
        onCreateGroup={() => { setRoomModalMode('create'); setShowRoomModal(true) }}
        onJoinGroup={() => { setRoomModalMode('join'); setShowRoomModal(true) }}
      />
      <ChatWindow
        messages={messages}
        selected={selected}
        currentUser={user}
        onSendMessage={sendMessage}
        typingUser={typingUser}
        onTyping={handleTyping}
        onStopTyping={handleStopTyping}
      />
      {showRoomModal && (
        <CreateGroupModal
          users={users}
          mode={roomModalMode}
          onClose={() => setShowRoomModal(false)}
          onCreated={handleRoomCreated}
        />
      )}
    </div>
  )
}
