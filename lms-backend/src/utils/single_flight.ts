/**
 * Generic in-memory single-flight (request coalescing) utility.
 *
 * Ensures that duplicate concurrent operations for the same key share a single
 * in-flight execution, suppressing cache stampedes / thundering herds.
 */

export class SingleFlightTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SingleFlightTimeoutError";
    Object.setPrototypeOf(this, SingleFlightTimeoutError.prototype);
  }
}

export interface SingleFlightOptions {
  /**
   * Timeout in milliseconds. If specified and positive, a flight taking longer
   * than this duration will be rejected with SingleFlightTimeoutError and removed
   * from the active flights map.
   */
  timeoutMs?: number;
}

export interface SingleFlightGroupOptions {
  /**
   * Default timeout in milliseconds for all flights managed by this group,
   * unless overridden in the `do()` options.
   */
  defaultTimeoutMs?: number;
}

export interface SingleFlightMetrics {
  flights_started: number;
  flights_joined: number;
  flights_failed: number;
}

interface Flight<T> {
  key: string;
  promise: Promise<T>;
  settled: boolean;
  timeoutTimer?: ReturnType<typeof setTimeout>;
}

export type SingleFlightConfig = number | SingleFlightOptions;

export class SingleFlightGroup {
  private flights = new Map<string, Flight<any>>();
  private defaultTimeoutMs?: number;

  private _metrics: SingleFlightMetrics = {
    flights_started: 0,
    flights_joined: 0,
    flights_failed: 0,
  };

  constructor(options?: SingleFlightGroupOptions) {
    if (options?.defaultTimeoutMs !== undefined && options.defaultTimeoutMs > 0) {
      this.defaultTimeoutMs = options.defaultTimeoutMs;
    }
  }

  /**
   * Execute or join an in-flight operation for the given key.
   *
   * If a flight is already active for `key`, returns the existing Promise
   * without invoking `loader`.
   * If no flight is active, creates and registers the Promise synchronously
   * in the Map before calling `loader`.
   *
   * @param key Unique identifier for the flight.
   * @param loader Asynchronous or synchronous function that loads the resource.
   * @param options Optional timeout in ms or configuration object.
   */
  public do<T>(
    key: string,
    loader: () => Promise<T> | T,
    options?: SingleFlightConfig
  ): Promise<T> {
    const existing = this.flights.get(key);
    if (existing) {
      this._metrics.flights_joined++;
      return existing.promise as Promise<T>;
    }

    this._metrics.flights_started++;

    // Resolve effective timeout
    let timeoutMs: number | undefined;
    if (typeof options === "number") {
      timeoutMs = options;
    } else if (options && typeof options === "object") {
      timeoutMs = options.timeoutMs;
    }
    if (timeoutMs === undefined) {
      timeoutMs = this.defaultTimeoutMs;
    }

    let resolveFlight!: (value: T | PromiseLike<T>) => void;
    let rejectFlight!: (reason?: any) => void;

    const flightPromise = new Promise<T>((resolve, reject) => {
      resolveFlight = resolve;
      rejectFlight = reject;
    });

    const flight: Flight<T> = {
      key,
      promise: flightPromise,
      settled: false,
    };

    // Requirement 4: Store in Map synchronously before any await
    this.flights.set(key, flight);

    // Setup configurable timeout if specified
    if (timeoutMs !== undefined && timeoutMs > 0) {
      flight.timeoutTimer = setTimeout(() => {
        if (flight.settled) return;
        flight.settled = true;

        // Stale-flight protection: only delete if key still maps to THIS flight
        this.cleanup(flight);

        this._metrics.flights_failed++;

        const timeoutError = new SingleFlightTimeoutError(
          `SingleFlight: loader for key "${key}" timed out after ${timeoutMs}ms`
        );
        rejectFlight(timeoutError);
      }, timeoutMs);
    }

    const settleSuccess = (value: T): void => {
      if (flight.settled) return;
      flight.settled = true;

      if (flight.timeoutTimer) {
        clearTimeout(flight.timeoutTimer);
        flight.timeoutTimer = undefined;
      }

      this.cleanup(flight);
      resolveFlight(value);
    };

    const settleFailure = (err: unknown): void => {
      if (flight.settled) return;
      flight.settled = true;

      if (flight.timeoutTimer) {
        clearTimeout(flight.timeoutTimer);
        flight.timeoutTimer = undefined;
      }

      this.cleanup(flight);
      this._metrics.flights_failed++;
      rejectFlight(err);
    };

    // Requirement 6: Handle synchronous throws and asynchronous rejections uniformly
    try {
      const result = loader();
      Promise.resolve(result)
        .then((val) => {
          settleSuccess(val);
        })
        .catch((err) => {
          settleFailure(err);
        });
    } catch (syncErr) {
      settleFailure(syncErr);
    }

    return flightPromise;
  }

  /**
   * Stale-flight safe cleanup: removes the flight from the Map only if
   * the map still holds reference to this specific flight instance.
   */
  private cleanup(flight: Flight<any>): void {
    if (this.flights.get(flight.key) === flight) {
      this.flights.delete(flight.key);
    }
  }

  /**
   * Current number of in-flight promises in the Map.
   */
  public get size(): number {
    return this.flights.size;
  }

  /**
   * Current number of in-flight promises in the Map (alias method for testing).
   */
  public getMapSize(): number {
    return this.flights.size;
  }

  /**
   * Check if a key currently has an active in-flight Promise.
   */
  public has(key: string): boolean {
    return this.flights.has(key);
  }

  /**
   * Snapshot of current flight metrics.
   */
  public get metrics(): Readonly<SingleFlightMetrics> {
    return { ...this._metrics };
  }

  /**
   * Method returning a snapshot of metrics.
   */
  public getMetrics(): SingleFlightMetrics {
    return { ...this._metrics };
  }

  public get flights_started(): number {
    return this._metrics.flights_started;
  }

  public get flights_joined(): number {
    return this._metrics.flights_joined;
  }

  public get flights_failed(): number {
    return this._metrics.flights_failed;
  }

  /**
   * Reset metrics counters to zero.
   */
  public resetMetrics(): void {
    this._metrics.flights_started = 0;
    this._metrics.flights_joined = 0;
    this._metrics.flights_failed = 0;
  }

  /**
   * Reset map and clear active timers (useful between test cases).
   */
  public reset(): void {
    for (const flight of this.flights.values()) {
      if (flight.timeoutTimer) {
        clearTimeout(flight.timeoutTimer);
      }
    }
    this.flights.clear();
    this.resetMetrics();
  }
}

// Alias for flexibility
export { SingleFlightGroup as SingleFlight };

// Shared default instance
export const singleFlight = new SingleFlightGroup();

/**
 * Convenience helper that executes a flight on the default shared instance.
 */
export function singleFlightDo<T>(
  key: string,
  loader: () => Promise<T> | T,
  options?: SingleFlightConfig
): Promise<T> {
  return singleFlight.do<T>(key, loader, options);
}

export default singleFlight;

