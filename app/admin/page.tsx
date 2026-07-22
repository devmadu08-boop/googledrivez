"use client";

import { ArrowLeft, Check, Clock3, FileVideo2, LogOut, RefreshCw, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type AccessStatus = "pending" | "accepted" | "rejected";
type AccessRequest = {
  id: string;
  email: string;
  note: string;
  fileId: string;
  fileName: string;
  status: AccessStatus;
  createdAt: string;
  reviewedAt: string | null;
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState("");

  const loadRequests = useCallback(async () => {
    const response = await fetch("/api/admin/requests", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load requests.");
    setRequests(result.requests ?? []);
    setAuthenticated(true);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/requests", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!active) return;
        if (response.status === 401) { setAuthenticated(false); return; }
        if (!response.ok) throw new Error(result.error ?? "Could not load requests.");
        setRequests(result.requests ?? []);
        setAuthenticated(true);
      })
      .catch((reason) => { if (active) { setError(reason.message); setAuthenticated(false); } });
    return () => { active = false; };
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Login failed.");
      setPassword("");
      await loadRequests();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const review = async (id: string, status: "accepted" | "rejected") => {
    setReviewing(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Review failed.");
      setRequests((current) => current.map((item) => item.id === id ? result.request : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Review failed.");
    } finally {
      setReviewing("");
    }
  };

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthenticated(false);
    setRequests([]);
  };

  if (authenticated !== true) {
    return (
      <main className="admin-login-shell">
        <Link className="admin-back" href="/"><ArrowLeft size={17} /> Back to vault</Link>
        <form className="admin-login-card" onSubmit={login}>
          <div className="admin-lock"><ShieldCheck size={28} /></div>
          <span>PIXVAULT CONTROL</span>
          <h1>Admin access</h1>
          <p>Enter the private admin password to review media access requests.</p>
          <label>Admin password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="Enter password" /></label>
          {error && <div className="admin-error">{error}</div>}
          <button type="submit" disabled={busy || !password}>{busy ? "Checking…" : "Open admin panel"}</button>
        </form>
      </main>
    );
  }

  const pendingCount = requests.filter((item) => item.status === "pending").length;
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><div className="brand-mark"><ShieldCheck size={21} /></div><div><strong>PixVault Admin</strong><span>Access review console</span></div></div>
        <div><Link href="/"><ArrowLeft size={17} /> Vault</Link><button onClick={() => loadRequests().catch((reason) => setError(reason.message))}><RefreshCw size={17} /> Refresh</button><button onClick={logout}><LogOut size={17} /> Sign out</button></div>
      </header>
      <section className="admin-content">
        <div className="admin-title"><div><span>ACCESS CONTROL</span><h1>Review requests</h1><p>Accept a request to unlock that file in the requester’s browser.</p></div><div className="pending-count"><strong>{pendingCount}</strong><span>Pending</span></div></div>
        {error && <div className="admin-error wide">{error}</div>}
        <div className="request-list">
          {requests.length ? requests.map((item) => (
            <article className="request-card" key={item.id}>
              <div className="request-file"><FileVideo2 size={21} /><div><strong>{item.fileName}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div></div>
              <div className="request-person"><strong>{item.email}</strong><p>{item.note || "No note was added."}</p></div>
              <div className={`status-pill status-${item.status}`}>{item.status === "pending" && <Clock3 size={14} />}{item.status === "accepted" && <Check size={14} />}{item.status === "rejected" && <X size={14} />}{item.status}</div>
              <div className="request-actions">
                <button className="reject" onClick={() => review(item.id, "rejected")} disabled={reviewing === item.id || item.status !== "pending"}><X size={16} /> Reject</button>
                <button className="accept" onClick={() => review(item.id, "accepted")} disabled={reviewing === item.id || item.status !== "pending"}><Check size={16} /> Accept</button>
              </div>
            </article>
          )) : <div className="admin-empty"><ShieldCheck size={32} /><h2>No access requests</h2><p>New email and note requests will appear here.</p></div>}
        </div>
      </section>
    </main>
  );
}
