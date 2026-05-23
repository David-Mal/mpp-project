// ─────────────────────────────────────────────────────────────
// USERS VIEW — Admin-only panel showing all registered users.
// Allows the admin to delete accounts (cannot delete self).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { apiListUsers, apiDeleteUser } from "../data/api";

export default function UsersView({ currentUser, onBack }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiListUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    setDeleting(id);
    try {
      await apiDeleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      alert(err.message || "Could not delete user.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="stats-page page-enter">
      <header className="stats-header">
        <button className="form-back-btn" onClick={onBack}>← BACK</button>
        <h2 className="stats-title">USER MANAGEMENT</h2>
        <span className="stats-sub">Admin panel — {users.length} accounts</span>
      </header>

      <div className="stats-body" style={{ padding: "2rem" }}>
        {loading && <p style={{ color: "#aaa", textAlign: "center" }}>Loading…</p>}
        {error   && <p style={{ color: "#e06c75", textAlign: "center" }}>{error}</p>}

        {!loading && !error && (
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={u.id === currentUser.id ? "users-row--self" : ""}>
                  <td>{u.id}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || "—"}</td>
                  <td>
                    <span className={`role-badge role-badge--${u.role}`}>{u.role.toUpperCase()}</span>
                  </td>
                  <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                  <td>
                    {u.id !== currentUser.id && (
                      <button
                        className="users-delete-btn"
                        onClick={() => handleDelete(u.id)}
                        disabled={deleting === u.id}
                      >
                        {deleting === u.id ? "…" : "DELETE"}
                      </button>
                    )}
                    {u.id === currentUser.id && (
                      <span className="users-self-label">YOU</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
