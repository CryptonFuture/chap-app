import { useState, useEffect, useRef } from 'react'

const API_BASE = 'https://backend-rust-phi-84.vercel.app/api'

export default function ChatWindow({
  messages,
  selected,
  currentUser,
  onSendMessage,
  typingUser,
  onTyping,
  onStopTyping
}) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUser])

  useEffect(() => {
    setText('')
    setFile(null)
    setPreview(null)
  }, [selected])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim() && !file) return
    setUploading(true)
    try {
      await onSendMessage({ content: text.trim(), file })
      setText('')
      setFile(null)
      setPreview(null)
      onStopTyping()
    } finally {
      setUploading(false)
    }
  }

  const handleChange = (e) => {
    setText(e.target.value)
    onTyping()
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => onStopTyping(), 1500)
  }

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB')
      return
    }
    setFile(f)
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target.result)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  const removeFile = () => {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const copyRoomCode = () => {
    if (selected.data?.roomCode) {
      navigator.clipboard.writeText(selected.data.roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getInitial = (name) => name?.charAt(0).toUpperCase() || '?'

  const getTitle = () => {
    if (selected.type === 'public') return 'Public Lobby'
    if (selected.type === 'private') return selected.data?.username || 'User'
    if (selected.type === 'group') return selected.data?.name || 'Room'
    return 'Chat'
  }

  const getSubtitle = () => {
    if (selected.type === 'public') return 'Open chat for everyone'
    if (selected.type === 'private') return selected.data?.isOnline ? 'Online' : 'Offline'
    if (selected.type === 'group') {
      const parts = [`${selected.data?.members?.length || 0} members`]
      if (selected.data?.isPublic) parts.push('Public')
      return parts.join(' · ')
    }
    return ''
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="avatar">
          {selected.type === 'public' && '🌐'}
          {selected.type === 'private' && getInitial(selected.data?.username)}
          {selected.type === 'group' && (
            selected.data?.avatar
              ? <img src={`${API_BASE}${selected.data.avatar}`} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : getInitial(selected.data?.name)
          )}
        </div>
        <div className="chat-header-info">
          <h3>{getTitle()}</h3>
          <p>{getSubtitle()}</p>
        </div>
        {selected.type === 'group' && selected.data?.roomCode && (
          <button className="room-code-btn" onClick={copyRoomCode} title="Copy room code">
            {copied ? '✓ Copied' : `#${selected.data.roomCode}`}
          </button>
        )}
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-chat-icon">💬</div>
            <p>No messages yet</p>
            <span>Send a message to start the conversation</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender._id === currentUser._id || msg.sender === currentUser._id
            return (
              <div key={msg._id} className={`message ${isOwn ? 'own' : ''}`}>
                {!isOwn && (
                  <div className="avatar small">
                    {getInitial(msg.sender.username || msg.sender)}
                  </div>
                )}
                <div className="message-content">
                  {!isOwn && (
                    <div className="message-sender">
                      {msg.sender.username || 'User'}
                    </div>
                  )}

                  {msg.messageType === 'image' && msg.fileUrl && (
                    <a href={`${API_BASE}${msg.fileUrl}`} target="_blank" rel="noreferrer" className="msg-image-link">
                      <img src={`${API_BASE}${msg.fileUrl}`} alt={msg.fileName || 'Image'} className="msg-image" />
                    </a>
                  )}

                  {msg.messageType === 'file' && msg.fileUrl && (
                    <a href={`${API_BASE}${msg.fileUrl}`} target="_blank" rel="noreferrer" className="msg-file" download={msg.fileName}>
                      <span className="file-icon">📎</span>
                      <div className="file-info">
                        <span className="file-name">{msg.fileName || 'File'}</span>
                        <span className="file-size">{formatSize(msg.fileSize)}</span>
                      </div>
                    </a>
                  )}

                  {msg.content && <div className="message-text">{msg.content}</div>}
                  <div className="message-time">{formatTime(msg.createdAt)}</div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {typingUser && (
        <div className="typing-indicator">
          <span className="typing-dots"><i></i><i></i><i></i></span>
          {typingUser} is typing...
        </div>
      )}

      {(preview || file) && (
        <div className="file-preview-bar">
          {preview ? (
            <img src={preview} alt="Preview" className="preview-thumb" />
          ) : (
            <span className="preview-file-name">📎 {file?.name}</span>
          )}
          <button type="button" className="remove-file-btn" onClick={removeFile}>✕</button>
        </div>
      )}

      <form className="message-input-area" onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar,.xls,.xlsx,.ppt,.pptx"
          style={{ display: 'none' }}
        />
        <button type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach" disabled={uploading}>
          📎
        </button>
        <input
          type="text"
          className="message-input"
          placeholder="Type a message..."
          value={text}
          onChange={handleChange}
          autoComplete="off"
          disabled={uploading}
        />
        <button type="submit" className="send-btn" disabled={(!text.trim() && !file) || uploading}>
          {uploading ? '...' : '➤'}
        </button>
      </form>
    </div>
  )
}
