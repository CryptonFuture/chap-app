import { useState } from 'react'
import api from '../services/api'

export default function CreateGroupModal({ users, onClose, onCreated, mode = 'create' }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(mode === 'join' ? 'join' : 'create') // create | join

  const toggleMember = (id) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Room name is required')
      return
    }
    setError('')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('description', description.trim())
      formData.append('members', JSON.stringify(selectedMembers))
      formData.append('isPublic', isPublic)

      const res = await api.post('/groups', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      onCreated(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!roomCode.trim()) {
      setError('Enter a room code')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/groups/join', { roomCode: roomCode.trim() })
      onCreated(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card premium-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-glow"></div>

        <div className="modal-header">
          <div>
            <h2>{tab === 'create' ? 'Create Room' : 'Join Room'}</h2>
            <p className="modal-sub">
              {tab === 'create' ? 'Start a new conversation space' : 'Enter invite code to join'}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${tab === 'create' ? 'active' : ''}`}
            onClick={() => { setTab('create'); setError('') }}
          >
            Create
          </button>
          <button
            type="button"
            className={`modal-tab ${tab === 'join' ? 'active' : ''}`}
            onClick={() => { setTab('join'); setError('') }}
          >
            Join with Code
          </button>
        </div>

        {error && (
          <div className="error-message" style={{ marginBottom: 16 }}>
            <span className="error-icon">⚠</span> {error}
          </div>
        )}

        {tab === 'create' ? (
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Room Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Design Team, Late Night Chat"
                maxLength={50}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What's this room about?"
                maxLength={200}
              />
            </div>

            <div className="form-group">
              <label className="toggle-label">
                <span>Public Room</span>
                <span className="toggle-hint">{isPublic ? 'Anyone can join with code' : 'Invite only'}</span>
              </label>
              <button
                type="button"
                className={`toggle-switch ${isPublic ? 'on' : ''}`}
                onClick={() => setIsPublic(!isPublic)}
              >
                <span className="toggle-knob"></span>
              </button>
            </div>

            <div className="form-group">
              <label>Invite Members (optional)</label>
              <div className="members-picker">
                {users.length === 0 ? (
                  <p className="empty-hint">No other users yet</p>
                ) : (
                  users.map(u => (
                    <label key={u._id} className={`member-option ${selectedMembers.includes(u._id) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(u._id)}
                        onChange={() => toggleMember(u._id)}
                      />
                      <span className="member-avatar">{u.username?.charAt(0).toUpperCase()}</span>
                      <span className="member-name">{u.username}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <><span className="btn-spinner"></span> Creating...</> : 'Create Room'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin}>
            <div className="form-group">
              <label>Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. A3K9X2"
                maxLength={8}
                className="room-code-input"
                autoFocus
              />
              <p className="field-hint">Ask the room admin for the 6-character code</p>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <><span className="btn-spinner"></span> Joining...</> : 'Join Room'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
