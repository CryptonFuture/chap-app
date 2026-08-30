export default function Sidebar({
  users,
  groups,
  onlineUsers,
  selected,
  onSelect,
  currentUser,
  onLogout,
  loading,
  onCreateGroup,
  onJoinGroup
}) {
  const getInitial = (name) => name?.charAt(0).toUpperCase() || '?'
  const isOnline = (userId) => onlineUsers.includes(userId) || users.find(u => u._id === userId)?.isOnline

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-icon">💬</span>
          <h2>ChatApp</h2>
        </div>
        <div className="user-info">
          <div className="avatar small" title={currentUser?.username}>
            {getInitial(currentUser?.username)}
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">⎋</button>
        </div>
      </div>

      <div className="sidebar-section">
        <button
          className={`nav-item ${selected.type === 'public' ? 'active' : ''}`}
          onClick={() => onSelect({ type: 'public', data: null })}
        >
          <span className="nav-icon">🌐</span>
          <span>Public Lobby</span>
        </button>
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <span>Rooms</span>
          <div className="section-actions">
            <button className="icon-btn" onClick={onJoinGroup} title="Join Room">🔗</button>
            <button className="icon-btn primary" onClick={onCreateGroup} title="Create Room">+</button>
          </div>
        </div>
        <div className="list-scroll">
          {loading ? (
            <div className="empty-hint">Loading rooms...</div>
          ) : groups.length === 0 ? (
            <div className="empty-hint">
              No rooms yet<br />
              <button className="text-link" onClick={onCreateGroup}>Create one</button>
            </div>
          ) : (
            groups.map(g => (
              <div
                key={g._id}
                className={`user-item ${selected.type === 'group' && selected.data?._id === g._id ? 'active' : ''}`}
                onClick={() => onSelect({ type: 'group', data: g })}
              >
                <div className="avatar small group-avatar">
                  {g.avatar ? (
                    <img src={`http://localhost:5000${g.avatar}`} alt="" />
                  ) : (
                    <span>{getInitial(g.name)}</span>
                  )}
                </div>
                <div className="user-item-info">
                  <div className="user-item-name">
                    {g.name}
                    {g.isPublic && <span className="badge-public">Public</span>}
                  </div>
                  <div className="user-item-status">
                    {g.members?.length || 0} members
                    {g.roomCode && <span className="room-code-tag">#{g.roomCode}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-section flex-grow">
        <div className="section-header">
          <span>Direct Messages</span>
        </div>
        <div className="list-scroll">
          {loading ? (
            <div className="empty-hint">Loading...</div>
          ) : users.length === 0 ? (
            <div className="empty-hint">No other users yet</div>
          ) : (
            users.map(u => (
              <div
                key={u._id}
                className={`user-item ${selected.type === 'private' && selected.data?._id === u._id ? 'active' : ''}`}
                onClick={() => onSelect({ type: 'private', data: u })}
              >
                <div className="avatar-wrap">
                  <div className="avatar small">{getInitial(u.username)}</div>
                  {isOnline(u._id) && <span className="online-indicator"></span>}
                </div>
                <div className="user-item-info">
                  <div className="user-item-name">{u.username}</div>
                  <div className="user-item-status">
                    {isOnline(u._id) ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
