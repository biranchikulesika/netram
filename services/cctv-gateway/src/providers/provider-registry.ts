import type { CameraProvider, CameraRef, CameraSnapshotResult } from "./provider.js";

/**
 * Composite Camera Provider & Registry (AGENTS.md §7, §42).
 *
 * Aggregates multiple underlying camera provider adapters (Simulated, RTSP, ONVIF, HLS)
 * behind a unified CameraProvider interface. Routes camera operations dynamically
 * based on the registered providers owning each camera ID.
 */
export class ProviderRegistry implements CameraProvider {
  readonly name = "registry";

  private providers: Map<string, CameraProvider> = new Map();
  // Cache mapping cameraId -> providerName for fast lookup
  private cameraToProvider: Map<string, string> = new Map();
  /**
   * Provider used when NO registered provider claims a camera (Phase 3).
   * The gateway is camera-context-driven: the NETRAM API passes camera
   * configuration from the DB, so the registry cannot rely on listCameras()
   * membership alone. The default provider exists for the dev rig (simulated
   * source); in production it stays unset and unknown cameras fail closed.
   */
  private defaultProviderName: string | null = null;

  constructor(initialProviders: CameraProvider[] = []) {
    for (const p of initialProviders) {
      this.registerProvider(p);
    }
  }

  /**
   * Marks a provider as the fallback for cameras no provider claims.
   * Dev-rig mechanism only - never set in production-oriented configs.
   */
  setDefaultProvider(providerName: string): this {
    if (!this.providers.has(providerName)) {
      throw new Error(`Cannot set unknown default provider: ${providerName}`);
    }
    this.defaultProviderName = providerName;
    return this;
  }

  /**
   * Registers a provider adapter in the registry.
   */
  registerProvider(provider: CameraProvider): this {
    this.providers.set(provider.name, provider);
    return this;
  }

  /**
   * Unregisters a provider adapter from the registry.
   */
  unregisterProvider(providerName: string): boolean {
    const deleted = this.providers.delete(providerName);
    if (deleted) {
      // Clear mappings pointing to this provider
      for (const [camId, pName] of this.cameraToProvider.entries()) {
        if (pName === providerName) {
          this.cameraToProvider.delete(camId);
        }
      }
    }
    return deleted;
  }

  /**
   * Retrieves a registered provider by name.
   */
  getProvider(providerName: string): CameraProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Lists all registered provider adapters.
   */
  listProviders(): CameraProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Locates the provider adapter that owns the specified camera.
   */
  async findProviderForCamera(cameraId: string): Promise<CameraProvider | undefined> {
    // 1. Check cached lookup
    const cachedName = this.cameraToProvider.get(cameraId);
    if (cachedName && this.providers.has(cachedName)) {
      return this.providers.get(cachedName);
    }

    // 2. Query registered providers
    for (const provider of this.providers.values()) {
      try {
        const cameras = await provider.listCameras();
        if (cameras.some((c) => c.id === cameraId)) {
          this.cameraToProvider.set(cameraId, provider.name);
          return provider;
        }
      } catch {
        // Skip failing provider during lookup
      }
    }

    // 3. Fall back to the default provider (dev rig) when configured.
    if (this.defaultProviderName !== null) {
      const fallback = this.providers.get(this.defaultProviderName);
      if (fallback) {
        this.cameraToProvider.set(cameraId, fallback.name);
        return fallback;
      }
    }

    return undefined;
  }

  /**
   * Explicitly binds a camera ID to a provider name for direct routing.
   */
  bindCamera(cameraId: string, providerName: string): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Cannot bind camera to unknown provider: ${providerName}`);
    }
    this.cameraToProvider.set(cameraId, providerName);
  }

  async listCameras(): Promise<CameraRef[]> {
    const allCameras: CameraRef[] = [];
    for (const provider of this.providers.values()) {
      try {
        const cameras = await provider.listCameras();
        for (const cam of cameras) {
          this.cameraToProvider.set(cam.id, provider.name);
          allCameras.push(cam);
        }
      } catch {
        // Tolerates individual provider listing errors without failing whole registry
      }
    }
    return allCameras;
  }

  async cameraHealth(cameraId: string): Promise<CameraRef["status"]> {
    const provider = await this.findProviderForCamera(cameraId);
    if (!provider) {
      return "offline";
    }
    return provider.cameraHealth(cameraId);
  }

  async acquireRawStream(cameraId: string): Promise<string> {
    const provider = await this.findProviderForCamera(cameraId);
    if (!provider) {
      throw new Error(`No camera provider found for camera: ${cameraId}`);
    }
    return provider.acquireRawStream(cameraId);
  }

  async acquireSnapshot(cameraId: string): Promise<CameraSnapshotResult> {
    const provider = await this.findProviderForCamera(cameraId);
    if (!provider) {
      throw new Error(`No camera provider found for camera: ${cameraId}`);
    }
    return provider.acquireSnapshot(cameraId);
  }
}
