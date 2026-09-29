// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
// @ts-expect-error react-dom/client declarations are omitted in React Native environment
import { createRoot, type Root } from "react-dom/client";
import { InAppCameraModal, type CapturedMediaItem } from "./InAppCameraModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const byLabel = (label: string) => document.body.querySelector(`[aria-label="${label}"]`);

// react-native-web drives onPress straight off the native click, but only when
// `altKey === false`, so a MouseEvent (not a bare Event) is required. Awaiting
// `act` also flushes the async capture the handler kicks off.
const press = async (label: string) => {
  const el = byLabel(label);
  if (!el) throw new Error(`no element labelled "${label}"`);
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
};

// react-dom tracks the last value on the DOM node, so a plain `el.value = x`
// is swallowed. Go through the prototype setter to make React see the change.
const type = (el: Element, text: string) => {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value")!.set!.call(el, text);
  act(() => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

let root: Root | null = null;

// Minimal MediaRecorder standing in for the browser's, so the web recording
// path can run. happy-dom provides neither getUserMedia nor MediaRecorder.
const fakeWebRecording = () => {
  const stream = { getTracks: () => [] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  });
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as never;
  URL.createObjectURL = (() => "blob:mock-recording") as never;

  class FakeMediaRecorder {
    static isTypeSupported = () => true;
    state = "inactive";
    mimeType = "video/webm";
    ondataavailable: ((e: { data: { size: number } }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.onstop?.();
    }
  }
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeMediaRecorder;
};

// react-native is aliased to react-native-web here, so the modal snaps a photo
// through a 2D canvas. happy-dom ships no canvas implementation, so give it
// the two calls the capture path makes.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() =>
    ({ drawImage: () => {} }) as unknown as CanvasRenderingContext2D) as never;
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,AAAA";
});

const renderModal = (
  onSaveMedia: (items: CapturedMediaItem[]) => Promise<boolean>,
  onClose = vi.fn(),
  initialMode: "photo" | "video" = "photo",
) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
    root.render(
      <InAppCameraModal
        visible
        initialMode={initialMode}
        onClose={onClose}
        onSaveMedia={onSaveMedia}
      />,
    );
  });
  return onClose;
};

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("InAppCameraModal capture roll", () => {
  it("shows the camera controls before anything is captured", () => {
    renderModal(vi.fn(async () => true));

    expect(byLabel("Take photo")).toBeTruthy();
    expect(byLabel("Close camera")).toBeTruthy();
    expect(byLabel("Toggle flash")).toBeTruthy();
    expect(byLabel("Review captured media")).toBeNull();
  });

  it("keeps a capture on the roll instead of closing or prompting for a note", async () => {
    renderModal(vi.fn(async () => true));

    await press("Take photo");

    expect(byLabel("Review captured media")).toBeTruthy();
    expect(document.body.textContent).toContain("1");
    expect(byLabel("Save captures")).toBeNull();
  });

  it("saves the accumulated captures with their captions in one call", async () => {
    const onSaveMedia = vi.fn(async (_items: CapturedMediaItem[]) => true);
    const onClose = renderModal(onSaveMedia);

    await press("Take photo");
    await press("Take photo");
    await press("Review captured media");

    const caption = document.body.querySelector("textarea")!;
    type(caption, "Seepage along the plinth");
    await press("Save captures");

    expect(onSaveMedia).toHaveBeenCalledTimes(1);
    const saved = onSaveMedia.mock.calls[0]![0];
    expect(saved).toHaveLength(2);
    expect(saved[0]!.evidenceType).toBe("photo");
    expect(saved[0]!.uri).toBe("data:image/jpeg;base64,AAAA");
    // The gallery button opens the most recent capture, so that is the item the
    // caption lands on; the earlier one stays blank.
    expect(saved.map((i: CapturedMediaItem) => i.note)).toEqual([
      "",
      "Seepage along the plinth",
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it("closes straight away when there is nothing to lose", async () => {
    const onClose = renderModal(vi.fn(async () => true));

    await press("Close camera");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("caps a web recording at 60s from the clock tick it captured at start", async () => {
    // MediaRecorder has no duration limit, so the cap is the tick's job — and
    // the tick holds the handler from the render before recording began.
    const onSaveMedia = vi.fn(async (_items: CapturedMediaItem[]) => true);
    fakeWebRecording();
    vi.useFakeTimers();
    try {
      renderModal(onSaveMedia, vi.fn(), "video");
      await act(async () => {}); // let the getUserMedia effect settle
      await press("Start recording");

      expect(byLabel("Stop recording")).toBeTruthy();
      vi.advanceTimersByTime(59_000);
      expect(byLabel("Stop recording")).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });

      await press("Review captured media");
      await press("Save captures");
      expect(onSaveMedia).toHaveBeenCalledTimes(1);
      expect(onSaveMedia.mock.calls[0]![0]).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
