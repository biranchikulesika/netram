"use client";

import { useState } from "react";
import type { Evidence } from "@netram/types";
import { useRouter } from "next/navigation";
import { formatDateTime } from "../../../lib/presentation";
import { IconCamera } from "../../components/icons";

export interface EvidenceGalleryProps {
  inspectionId: string;
  items: Evidence[];
  canCapture: boolean;
}

export function EvidenceGallery({ inspectionId, items, canCapture }: EvidenceGalleryProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<Record<string, File | null>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [hashInput, setHashInput] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // New evidence capture form state
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [newEvidenceType, setNewEvidenceType] = useState<Evidence["evidenceType"]>("photo");
  const [newFileName, setNewFileName] = useState("");
  const [newHash, setNewHash] = useState("");

  async function handleUpload(evidenceId: string) {
    const file = selectedFile[evidenceId];
    if (!file) return;

    setUploadingId(evidenceId);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/evidence/${evidenceId}/uploads`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Upload failed");
      }

      setSelectedFile((prev) => ({ ...prev, [evidenceId]: null }));
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleVerify(evidenceId: string) {
    const hash = hashInput[evidenceId];
    if (!hash) return;
    const normalizedHash = hash.trim().startsWith("sha256:")
      ? hash.trim()
      : `sha256:${hash.trim()}`;

    setVerifyingId(evidenceId);
    setActionError(null);
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/integrity-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: normalizedHash }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Integrity check failed");
      }

      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Integrity check failed");
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleCaptureNew(e: React.FormEvent) {
    e.preventDefault();
    setCapturing(true);
    setActionError(null);

    try {
      const normalizedHash = newHash.trim()
        ? newHash.trim().startsWith("sha256:")
          ? newHash.trim()
          : `sha256:${newHash.trim()}`
        : undefined;

      const payload = {
        capturedAt: new Date().toISOString(),
        evidenceType: newEvidenceType,
        fileName: newFileName.trim() || undefined,
        contentHash: normalizedHash,
      };

      const res = await fetch(`/api/inspections/${inspectionId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Evidence metadata recording failed");
      }

      setShowCaptureModal(false);
      setNewFileName("");
      setNewHash("");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Recording failed");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <section className="evidence-section">
      <div className="section-title-row">
        <div>
          <h3>Inspection Evidence & Integrity</h3>
        </div>
        {canCapture && (
          <button onClick={() => setShowCaptureModal(true)} className="btn-secondary">
            + Record Evidence Metadata
          </button>
        )}
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconCamera width={20} height={20} />
          </div>
          <div className="empty-state-title">No evidence recorded yet</div>
          <p className="empty-state-sub">
            Operational media for this inspection will appear here as it is captured and verified
            from the field.
          </p>
        </div>
      ) : (
        <div className="evidence-grid">
          {items.map((item) => {
            const isPhoto = item.evidenceType === "photo";
            const isUploaded = item.uploadState === "uploaded";
            const isVerified = item.integrityState === "verified";

            return (
              <article key={item.id} className="evidence-card">
                <div className="card-media">
                  {isPhoto && isUploaded ? (
                    <img
                      src={`/api/evidence/${item.id}/content`}
                      alt={item.fileName ?? "Evidence Photo"}
                      loading="lazy"
                      className="thumbnail-img"
                      onClick={() => setPreviewImage(`/api/evidence/${item.id}/content`)}
                    />
                  ) : (
                    <div className="media-placeholder">
                      <span className="media-type-tag">{item.evidenceType.toUpperCase()}</span>
                      <span className="media-status-tag">{item.uploadState}</span>
                    </div>
                  )}
                </div>

                <div className="card-body">
                  <h4 className="file-name" title={item.fileName ?? "unnamed"}>
                    {item.fileName ?? "Evidence Object"}
                  </h4>

                  <dl className="meta-list">
                    <div>
                      <dt>Captured:</dt>
                      <dd>{formatDateTime(item.capturedAt)}</dd>
                    </div>
                    {item.latitude && item.longitude && (
                      <div>
                        <dt>GPS:</dt>
                        <dd>
                          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                        </dd>
                      </div>
                    )}
                    {item.deviceId && (
                      <div>
                        <dt>Device:</dt>
                        <dd>{item.deviceId}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="card-actions">
                    {isUploaded && (
                      <a
                        href={`/api/evidence/${item.id}/content`}
                        download={item.fileName ?? `evidence-${item.id}`}
                        className="btn-download"
                      >
                        Download Content
                      </a>
                    )}

                    {!isUploaded && canCapture && (
                      <div className="upload-box">
                        <input
                          type="file"
                          onChange={(e) =>
                            setSelectedFile((prev) => ({
                              ...prev,
                              [item.id]: e.target.files?.[0] ?? null,
                            }))
                          }
                          disabled={uploadingId === item.id}
                        />
                        <button
                          onClick={() => handleUpload(item.id)}
                          disabled={!selectedFile[item.id] || uploadingId === item.id}
                        >
                          {uploadingId === item.id ? "Uploading..." : "Upload File"}
                        </button>
                      </div>
                    )}

                    {isUploaded && !isVerified && (
                      <div className="reverify-box">
                        <input
                          type="text"
                          placeholder="sha256:<64 hex>"
                          value={hashInput[item.id] ?? ""}
                          onChange={(e) =>
                            setHashInput((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          disabled={verifyingId === item.id}
                        />
                        <button
                          onClick={() => handleVerify(item.id)}
                          disabled={!hashInput[item.id] || verifyingId === item.id}
                          className="btn-secondary"
                        >
                          {verifyingId === item.id ? "Checking..." : "Re-check"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox / Modal for Photo Zoom */}
      {previewImage && (
        <div className="lightbox-backdrop" onClick={() => setPreviewImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Evidence Full Preview" />
            <button className="btn-close" onClick={() => setPreviewImage(null)}>
              ✕ Close
            </button>
          </div>
        </div>
      )}

      {/* Modal to record new evidence metadata */}
      {showCaptureModal && (
        <div className="lightbox-backdrop" onClick={() => setShowCaptureModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h4>Record Evidence Metadata</h4>
            <form onSubmit={handleCaptureNew}>
              <div className="form-group">
                <label>Evidence Type</label>
                <select
                  value={newEvidenceType}
                  onChange={(e) => setNewEvidenceType(e.target.value as Evidence["evidenceType"])}
                >
                  <option value="photo">Photo</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="document">Document</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>File Name</label>
                <input
                  type="text"
                  placeholder="e.g. kitchen-inspection.jpg"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Capture-Time Content Hash (SHA-256)</label>
                <input
                  type="text"
                  placeholder="sha256:<64 hex lowercase chars> (optional)"
                  value={newHash}
                  onChange={(e) => setNewHash(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCaptureModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={capturing}>
                  {capturing ? "Recording..." : "Save Metadata"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
