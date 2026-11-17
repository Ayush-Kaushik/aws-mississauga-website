import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import type { Inquiry, InquiryCategory, InquiryStatus, Session, User } from "./types";

const SESSION_KEY = "volunteer-portal-session";

function readSession(): Session | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) as Session : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [activeView, setActiveView] = useState<"inquiries" | "reviewers">("inquiries");

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setActiveView("inquiries");
  }

  if (!session) {
    return <SignIn onSignedIn={(nextSession) => {
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    }} />;
  }

  if (session.user.role === "member") return <NoInquiryAccess session={session} onSignOut={signOut} />;
  if (activeView === "reviewers" && session.user.role === "admin") {
    return <ReviewerManagement session={session} onSignOut={signOut} activeView={activeView} onNavigate={setActiveView} />;
  }
  return <InquiryDashboard session={session} onSignOut={signOut} activeView="inquiries" onNavigate={setActiveView} />;
}

function SignIn({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSignedIn(await api.signIn(email.trim(), password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="signin-screen">
      <div className="signin-glow" aria-hidden="true" />
      <section className="signin-wrap">
        <a className="wordmark" href="/" aria-label="AWS User Group Mississauga volunteer portal">
          <span className="wordmark-mark">M</span>
          <span><b>AWS User Group</b><small>MISSISSAUGA · VOLUNTEER PORTAL</small></span>
        </a>
        <div className="signin-content">
          <p className="eyebrow">A little help goes a long way</p>
          <h1>Good things<br /><span>happen together.</span></h1>
          <p className="signin-lede">Sign in to find your next way to make the community stronger.</p>
          <form className="signin-form" onSubmit={submit}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary signin-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<span aria-hidden="true">↗</span></button>
          </form>
          <p className="signin-foot">Community work, made easier.</p>
        </div>
      </section>
      <aside className="signin-art" aria-label="Volunteer community message">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <div className="art-note note-top"><span className="note-dot" /> PEOPLE FIRST <span>01 / 03</span></div>
        <div className="art-copy"><span className="art-index">VOLUNTEER / 2026</span><p>Small acts.<br /><em>Lasting</em><br />community.</p><span className="art-rule" /></div>
        <div className="art-note note-bottom"><span>MISSISSAUGA, ONTARIO</span><span>BUILT BY THE COMMUNITY</span></div>
      </aside>
    </main>
  );
}

function DashboardShell({ session, onSignOut, children, eyebrow, title, description, activeView, onNavigate }: {
  session: Session;
  onSignOut: () => void;
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  activeView: "inquiries" | "reviewers";
  onNavigate: (view: "inquiries" | "reviewers") => void;
}) {
  return (
    <div className="dashboard">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="AWS User Group Mississauga home">
          <span className="wordmark-mark">M</span>
          <span><b>AWS User Group</b><small>MISSISSAUGA</small></span>
        </a>
        <nav className="view-nav" aria-label="Portal sections">
          {session.user.role !== "member" && <button className={activeView === "inquiries" ? "view-nav-active" : ""} type="button" aria-current={activeView === "inquiries" ? "page" : undefined} onClick={() => onNavigate("inquiries")}>Inquiries</button>}
          {session.user.role === "admin" && <button className={activeView === "reviewers" ? "view-nav-active" : ""} type="button" aria-current={activeView === "reviewers" ? "page" : undefined} onClick={() => onNavigate("reviewers")}>Reviewers</button>}
        </nav>
        <div className="account"><span className="avatar">{session.user.email[0].toUpperCase()}</span><span className="account-details"><b>{session.user.email}</b><small>{session.user.role === "volunteer" ? "Volunteer Reviewer" : session.user.role}</small></span><button className="button button-quiet" type="button" onClick={onSignOut}>Sign out</button></div>
      </header>
      <main className="dashboard-main">
        <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div><div className="heading-mark" aria-hidden="true">M<span>·</span></div></div>
        {children}
      </main>
      <footer className="app-footer"><span>AWS USER GROUP MISSISSAUGA</span><span>Show up. Make a difference.</span></footer>
    </div>
  );
}

const inquiryStatusLabels: Record<InquiryStatus, string> = {
  new: "New",
  in_progress: "In progress",
  contacted: "Contacted",
  closed: "Closed",
};

function inquiryCategoryLabel(category: string): string {
  if (category === "volunteer") return "Volunteer";
  if (category === "sponsor") return "Sponsor";
  if (category === "speaker") return "Speaker";
  return category;
}

function ReviewerManagement({ session, onSignOut, activeView, onNavigate }: { session: Session; onSignOut: () => void; activeView: "inquiries" | "reviewers"; onNavigate: (view: "inquiries" | "reviewers") => void }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [reviewers, setReviewers] = useState<User[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyReviewer, setBusyReviewer] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setError("");
      const [nextCategories, nextUsers] = await Promise.all([api.inquiryCategories(session.token), api.users(session.token)]);
      setCategories(nextCategories);
      setReviewers(nextUsers.filter((user) => user.role === "volunteer"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load reviewer settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [session.token]);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api.createInquiryCategory(session.token, newCategory.trim());
      setCategories((current) => [...current, created.category]);
      setNewCategory("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The category could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function setCategoryAssignment(reviewer: User, category: string, assigned: boolean) {
    setBusyReviewer(reviewer.id);
    setError("");
    const inquiryCategories = assigned
      ? [...reviewer.inquiryCategories, category]
      : reviewer.inquiryCategories.filter((item) => item !== category);
    try {
      const updated = await api.setReviewerCategories(session.token, reviewer.id, inquiryCategories);
      setReviewers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reviewer categories could not be updated.");
    } finally {
      setBusyReviewer("");
    }
  }

  return (
    <DashboardShell session={session} onSignOut={onSignOut} activeView={activeView} onNavigate={onNavigate} eyebrow="Organizer space" title="Reviewer access." description="Create inquiry categories and manage reviewer assignments.">
      <form className="reviewer-category-form" onSubmit={(event) => void createCategory(event)}>
        <label htmlFor="new-category">New category</label><input id="new-category" value={newCategory} maxLength={50} required onChange={(event) => setNewCategory(event.target.value)} placeholder="e.g. Community partner" />
        <button className="button button-primary" type="submit" disabled={busy || !newCategory.trim()}>{busy ? "Adding…" : "Add category"}</button>
      </form>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {loading ? <Loading /> : <section className="reviewer-matrix-section" aria-label="Reviewer category assignments">
        {categories.length && reviewers.length ? <div className="reviewer-matrix-scroll"><table className="reviewer-matrix"><thead><tr><th scope="col">Inquiry category</th>{reviewers.map((reviewer) => <th scope="col" key={reviewer.id}>{reviewer.email}</th>)}</tr></thead><tbody>{categories.map((category) => <tr key={category}><th scope="row">{inquiryCategoryLabel(category)}</th>{reviewers.map((reviewer) => <td key={reviewer.id}><label className="reviewer-assignment"><input type="checkbox" aria-label={`${reviewer.email} assigned to ${inquiryCategoryLabel(category)}`} checked={reviewer.inquiryCategories.includes(category)} disabled={busyReviewer === reviewer.id} onChange={(event) => void setCategoryAssignment(reviewer, category, event.target.checked)} /><span className="visually-hidden">{reviewer.email}: {inquiryCategoryLabel(category)}</span></label></td>)}</tr>)}</tbody></table></div> : <EmptyState title="No reviewers or categories" text="Reviewer accounts and inquiry categories will appear here." />}
      </section>}
    </DashboardShell>
  );
}

function InquiryDashboard({ session, onSignOut, activeView, onNavigate }: { session: Session; onSignOut: () => void; activeView: "inquiries" | "reviewers"; onNavigate: (view: "inquiries" | "reviewers") => void }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [owners, setOwners] = useState<User[]>([]);
  const [categories, setCategories] = useState<InquiryCategory[]>([]);
  const [category, setCategory] = useState<InquiryCategory>("");
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | "all">("all");
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  async function refresh() {
    try {
      setError("");
      const [nextInquiries, nextOwners, nextCategories] = await Promise.all([api.inquiries(session.token), api.users(session.token), api.inquiryCategories(session.token)]);
      const reviewer = nextOwners.find((user) => user.id === session.user.id);
      const assignedCategories = session.user.role === "admin" ? nextCategories : nextCategories.filter((item) => (reviewer?.inquiryCategories ?? []).includes(item));
      setInquiries(nextInquiries);
      setOwners(nextOwners);
      setCategories(nextCategories);
      setCategory((current) => assignedCategories.includes(current) ? current : assignedCategories[0] ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load inquiries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [session.token]);

  const reviewer = owners.find((user) => user.id === session.user.id);
  const accessibleCategories = categories.filter((item) => session.user.role === "admin" || (reviewer?.inquiryCategories ?? []).includes(item));

  async function saveInquiry(id: string, changes: { status: InquiryStatus; ownerId: string | null }): Promise<string | null> {
    setActionError("");
    try {
      const updated = await api.updateInquiry(session.token, id, changes);
      setInquiries((current) => current.map((inquiry) => inquiry.id === updated.id ? updated : inquiry));
      setSelected(updated);
      return null;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The inquiry could not be updated.";
      setActionError(message);
      return message;
    }
  }

  async function addFollowUp(id: string, note: string): Promise<string | null> {
    try {
      const activity = await api.addFollowUp(session.token, id, note);
      setInquiries((current) => current.map((inquiry) => inquiry.id === id ? { ...inquiry, followUps: [...inquiry.followUps, activity] } : inquiry));
      setSelected((current) => current?.id === id ? { ...current, followUps: [...current.followUps, activity] } : current);
      return null;
    } catch (reason) {
      return reason instanceof Error ? reason.message : "The follow-up could not be recorded.";
    }
  }

  const visibleInquiries = inquiries.filter((inquiry) => inquiry.category === category && (statusFilter === "all" || inquiry.status === statusFilter));
  const ownerName = (ownerId: string | null) => owners.find((owner) => owner.id === ownerId)?.email ?? "Unassigned";

  return (
    <DashboardShell session={session} onSignOut={onSignOut} activeView={activeView} onNavigate={onNavigate} eyebrow="Organizer space" title="Inquiries, in good hands." description="Review community interest and keep each conversation moving.">
      <div className="inquiry-toolbar">
        <div className="inquiry-tabs" role="tablist" aria-label="Inquiry category">
          {accessibleCategories.map((item) => {
            const count = inquiries.filter((inquiry) => inquiry.category === item).length;
            return <button className={category === item ? "inquiry-tab inquiry-tab-active" : "inquiry-tab"} type="button" role="tab" aria-selected={category === item} key={item} onClick={() => setCategory(item)}>{inquiryCategoryLabel(item)}<span>{count}</span></button>;
          })}
        </div>
        <label className="inquiry-filter"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InquiryStatus | "all")}><option value="all">All statuses</option>{Object.entries(inquiryStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={() => void refresh()} /> : !accessibleCategories.length ? <EmptyState title="No categories assigned" text="Ask an admin to assign an inquiry category." /> : visibleInquiries.length ? (
        <section className="inquiry-table" aria-label={`${inquiryCategoryLabel(category)} inquiries`}>
          <div className="inquiry-table-head"><span>Name</span><span>Received</span><span>Status</span><span>Assigned owner</span></div>
          {visibleInquiries.map((inquiry) => <article className="inquiry-row" key={inquiry.id}>
            <button className="inquiry-name" type="button" onClick={() => setSelected(inquiry)}><strong>{inquiry.name}</strong><span>{inquiry.organization || inquiry.email}</span></button>
            <span className="inquiry-date">{new Date(`${inquiry.receivedAt}T00:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</span>
            <span className={`inquiry-status inquiry-status-${inquiry.status}`}>{inquiryStatusLabels[inquiry.status]}</span>
            <span className="inquiry-owner">{ownerName(inquiry.ownerId)}</span>
          </article>)}
        </section>
      ) : <EmptyState title="No matching inquiries" text="Try another status or check a different category." />}
      {selected && <InquiryDetails session={session} inquiry={selected} owners={owners.filter((owner) => owner.role === "admin" || owner.inquiryCategories.includes(selected.category))} onClose={() => setSelected(null)} onSave={saveInquiry} onAddFollowUp={addFollowUp} />}
    </DashboardShell>
  );
}

function InquiryDetails({ session, inquiry, owners, onClose, onSave, onAddFollowUp }: { session: Session; inquiry: Inquiry; owners: User[]; onClose: () => void; onSave: (id: string, changes: { status: InquiryStatus; ownerId: string | null }) => Promise<string | null>; onAddFollowUp: (id: string, note: string) => Promise<string | null> }) {
  const [status, setStatus] = useState(inquiry.status);
  const [ownerId, setOwnerId] = useState(inquiry.ownerId ?? "");
  const [followUpNote, setFollowUpNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [followUpError, setFollowUpError] = useState("");
  const assignedOwner = owners.find((owner) => owner.id === inquiry.ownerId)?.email ?? "Unassigned";
  const canAddFollowUp = session.user.role === "admin" || inquiry.ownerId === session.user.id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(await onSave(inquiry.id, { status, ownerId: ownerId || null }) || "");
    setBusy(false);
  }

  async function submitFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFollowUpBusy(true);
    const message = await onAddFollowUp(inquiry.id, followUpNote);
    setFollowUpError(message || "");
    if (!message) setFollowUpNote("");
    setFollowUpBusy(false);
  }

  const followUps = inquiry.followUps.slice().sort((first, second) => Date.parse(second.recordedAt) - Date.parse(first.recordedAt));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="record-modal inquiry-modal" role="dialog" aria-modal="true" aria-labelledby="inquiry-detail-title">
        <div className="modal-heading"><div><p className="eyebrow">{inquiry.category} inquiry · received {new Date(`${inquiry.receivedAt}T00:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</p><h2 id="inquiry-detail-title">{inquiry.name}</h2></div><button className="close-button" type="button" aria-label="Close" onClick={onClose}>×</button></div>
        <div className="inquiry-contact"><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>{inquiry.organization && <span>{inquiry.organization}</span>}</div>
        <p className="inquiry-message">{inquiry.message}</p>
        <div className="inquiry-detail-facts"><span><small>Current status</small><b className={`inquiry-status inquiry-status-${inquiry.status}`}>{inquiryStatusLabels[inquiry.status]}</b></span><span><small>Assigned volunteer manager</small><b>{assignedOwner}</b></span></div>
        <section className="follow-up-history" aria-labelledby="follow-up-history-title">
          <div className="follow-up-heading"><h3 id="follow-up-history-title">Follow-up history</h3><span>{followUps.length}</span></div>
          {followUps.length ? <ol>{followUps.map((activity) => <li key={activity.id}><div className="follow-up-meta"><time dateTime={activity.recordedAt}>{new Date(activity.recordedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time><span>{activity.userEmail}</span></div><p>{activity.note}</p></li>)}</ol> : <p className="follow-up-empty">No follow-up activity recorded.</p>}
        </section>
        <form className="record-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="inquiry-status">Status</label><select id="inquiry-status" value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus)}>{Object.entries(inquiryStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          {session.user.role === "admin" && <><label htmlFor="inquiry-owner">Assigned owner</label><select id="inquiry-owner" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Unassigned</option>{owners.map((owner) => <option value={owner.id} key={owner.id}>{owner.email}</option>)}</select></>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="button button-quiet" type="button" onClick={onClose}>Close</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
        </form>
        {canAddFollowUp ? <form className="follow-up-form" onSubmit={(event) => void submitFollowUp(event)}>
          <label htmlFor="inquiry-note">Add follow-up</label><textarea id="inquiry-note" maxLength={2000} rows={3} required value={followUpNote} onChange={(event) => { setFollowUpNote(event.target.value); setFollowUpError(""); }} placeholder="Describe the interaction…" />
          {followUpError && <p className="form-error" role="alert">{followUpError}</p>}
          <div className="form-actions"><button className="button button-primary" type="submit" disabled={followUpBusy || !followUpNote.trim()}>{followUpBusy ? "Recording…" : "Add activity"}</button></div>
        </form> : <p className="follow-up-permission">Only the assigned reviewer or an admin can record follow-up activity.</p>}
      </section>
    </div>
  );
}

function NoInquiryAccess({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  return <DashboardShell session={session} onSignOut={onSignOut} activeView="inquiries" onNavigate={() => undefined} eyebrow="Member space" title="Inquiry access is not available." description="This account does not have access to inquiry management."><EmptyState title="No inquiry access" text="Contact an organizer if you need access." /></DashboardShell>;
}

function Loading() {
  return <div className="loading-state" role="status"><span className="spinner" /> Loading…</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="empty-state error-state"><p>{message}</p><button className="text-action" type="button" onClick={onRetry}>Try again</button></div>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">✳</span><h3>{title}</h3><p>{text}</p>{action}</div>;
}