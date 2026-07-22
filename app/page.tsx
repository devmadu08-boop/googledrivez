"use client";

import {
  Clock3,
  Cloud,
  FileVideo2,
  FolderClosed,
  Grid2X2,
  HardDrive,
  Info,
  LayoutGrid,
  List,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type StoredFile = {
  id: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  demo?: boolean;
};
type FilesResponse = { configured?: boolean; files?: StoredFile[]; file?: StoredFile; error?: string };

const demoFiles: StoredFile[] = [
  {
    id: "demo-1",
    originalName: "sunset-beach.jpg",
    displayName: "sunset-beach.mp4",
    mimeType: "image/jpeg",
    size: 2_840_000,
    uploadedAt: "2026-07-22T08:30:00.000Z",
    demo: true,
  },
  {
    id: "demo-2",
    originalName: "team-photo.png",
    displayName: "team-photo.mp4",
    mimeType: "image/png",
    size: 1_280_000,
    uploadedAt: "2026-07-20T11:15:00.000Z",
    demo: true,
  },
  {
    id: "demo-3",
    originalName: "mountain-trip.jpeg",
    displayName: "mountain-trip.mp4",
    mimeType: "image/jpeg",
    size: 4_120_000,
    uploadedAt: "2026-07-18T05:45:00.000Z",
    demo: true,
  },
];

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(file);
  });

export default function Home() {
  const [files, setFiles] = useState<StoredFile[]>(demoFiles);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/files", { cache: "no-store" })
      .then((response) => response.json() as Promise<FilesResponse>)
      .then((result) => {
        if (!active) return;
        setConfigured(Boolean(result.configured));
        if (result.configured) setFiles(result.files ?? []);
      })
      .catch(() => active && setConfigured(false));
    return () => { active = false; };
  }, []);

  const visibleFiles = useMemo(
    () => files.filter((file) => file.displayName.toLowerCase().includes(search.toLowerCase())),
    [files, search],
  );

  const handleUpload = async (selected?: File) => {
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setNotice("Please select a photo file (JPG, PNG, WEBP or GIF). ");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setNotice("That photo is over the 5 MB upload limit.");
      return;
    }

    setUploading(true);
    setNotice("");
    setProgress(18);
    try {
      const data = await fileToBase64(selected);
      setProgress(55);
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected.name, type: selected.type, size: selected.size, data }),
      });
      const result = (await response.json()) as FilesResponse;
      if (!response.ok) throw new Error(result.error ?? "Upload failed.");
      if (!result.file) throw new Error("The uploaded file record was missing.");
      const uploadedFile = result.file;
      setProgress(100);
      setFiles((current) => [uploadedFile, ...current.filter((file) => !file.demo)]);
      setConfigured(true);
      setNotice(`${uploadedFile.displayName} was encoded and saved.`);
      window.setTimeout(() => setUploadOpen(false), 850);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      window.setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 900);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleUpload(event.dataTransfer.files[0]);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleUpload(event.target.files?.[0]);
    event.target.value = "";
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Cloud size={22} strokeWidth={2.3} /></div>
          <span>PixVault</span>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <button className="new-button" onClick={() => setUploadOpen(true)}>
          <Plus size={21} /> <span>New upload</span>
        </button>

        <nav className="nav-list" aria-label="File navigation">
          <button className="nav-item active"><HardDrive size={19} /><span>My vault</span></button>
          <button className="nav-item"><Clock3 size={19} /><span>Recent</span></button>
          <button className="nav-item"><Star size={19} /><span>Starred</span></button>
          <button className="nav-item"><Trash2 size={19} /><span>Trash</span></button>
        </nav>

        <div className="storage-card">
          <div className="storage-icon"><ShieldCheck size={19} /></div>
          <div>
            <strong>GitHub storage</strong>
            <p>Photos are stored as Base64 text files.</p>
          </div>
          <div className="storage-meter"><span /></div>
          <small>Private repository recommended</small>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={22} /></button>
          <label className="search-box">
            <Search size={20} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your files" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <button aria-label="Settings"><Settings size={20} /></button>
            <button aria-label="Information"><Info size={20} /></button>
            <div className="avatar">DM</div>
          </div>
        </header>

        <div className="content">
          <div className="content-heading">
            <div>
              <p className="eyebrow"><Sparkles size={15} /> PRIVATE MEDIA VAULT</p>
              <h1>My vault</h1>
              <p className="heading-copy">Your photos, stored as text and displayed as video files.</p>
            </div>
            <button className="upload-primary" onClick={() => setUploadOpen(true)}><UploadCloud size={19} /> Upload photo</button>
          </div>

          {configured === false && (
            <div className="setup-banner">
              <div className="setup-badge"><ShieldCheck size={21} /></div>
              <div><strong>Preview mode</strong><span>Add your GitHub repository settings to activate secure uploads. Sample files are shown below.</span></div>
              <code>See .env.example</code>
            </div>
          )}

          <section className="summary-strip" aria-label="Storage summary">
            <div className="summary-main"><div className="summary-icon"><FolderClosed size={22} /></div><div><strong>{files.length}</strong><span>Video files</span></div></div>
            <div className="summary-stat"><strong>{formatSize(files.reduce((sum, file) => sum + file.size, 0))}</strong><span>Original photo size</span></div>
            <div className="summary-stat"><strong>Text encoded</strong><span>Storage format</span></div>
            <div className="summary-security"><ShieldCheck size={18} /><span>Private repo ready</span></div>
          </section>

          <div className="file-toolbar">
            <div><h2>Files</h2><span>{visibleFiles.length} items</span></div>
            <div className="view-switch" role="group" aria-label="File view">
              <button className={view === "grid" ? "selected" : ""} onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 size={17} /></button>
              <button className={view === "list" ? "selected" : ""} onClick={() => setView("list")} aria-label="List view"><List size={19} /></button>
            </div>
          </div>

          {visibleFiles.length ? (
            <div className={`files files-${view}`}>
              {visibleFiles.map((file) => (
                <article className="file-card" key={file.id}>
                  <div className="file-preview">
                    <div className="preview-glow glow-one" /><div className="preview-glow glow-two" />
                    <span className="video-type">VIDEO</span>
                    <div className="play-button"><Play size={23} fill="currentColor" /></div>
                    <div className="file-corner"><FileVideo2 size={18} /></div>
                  </div>
                  <div className="file-details">
                    <div className="file-icon"><FileVideo2 size={20} /></div>
                    <div className="file-meta"><strong title={file.displayName}>{file.displayName}</strong><span>{formatSize(file.size)} · {formatDate(file.uploadedAt)}</span></div>
                    <button aria-label={`More options for ${file.displayName}`}><MoreHorizontal size={20} /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><LayoutGrid size={32} /><h3>No files found</h3><p>Try another search or upload your first photo.</p></div>
          )}
        </div>
      </section>

      {uploadOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !uploading && setUploadOpen(false)}>
          <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
            <div className="modal-heading"><div><span className="modal-kicker">TEXT CONVERSION</span><h2 id="upload-title">Upload a photo</h2><p>We’ll encode it as text and display it as a video file.</p></div><button onClick={() => setUploadOpen(false)} disabled={uploading} aria-label="Close upload"><X size={20} /></button></div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFileChange} hidden />
            <div className={`drop-zone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <div className="drop-icon"><UploadCloud size={29} /></div>
              <h3>Drop your photo here</h3>
              <p>JPG, PNG, WEBP or GIF · Maximum 5 MB</p>
              <button onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? "Encoding…" : "Choose a photo"}</button>
              {uploading && <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>}
            </div>
            {notice && <p className="upload-notice">{notice}</p>}
            <div className="privacy-note"><ShieldCheck size={18} /><span>Base64 is not encryption. Always use a private GitHub repository.</span></div>
          </section>
        </div>
      )}
    </main>
  );
}
