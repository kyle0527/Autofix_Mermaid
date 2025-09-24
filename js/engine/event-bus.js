/**
 * 🚌 Lightweight event bus for cross-module decoupling.
 *
 * The bus is intentionally framework-agnostic so it can operate in
 * browsers, workers, and Node runtimes without depending on `EventEmitter`.
 */

const DEFAULT_MAX_HISTORY = 50;
const DOM_EVENT_CHANNEL = 'autofix:event';

class EventBus {
  constructor() {
    this.listeners = new Map();
    this.onceListeners = new Map();
    this.history = [];
    this.maxHistory = DEFAULT_MAX_HISTORY;
  }

  /**
   * Register a persistent listener and return an unsubscribe function.
   * @param {string} event
   * @param {(payload: any) => void} handler
   * @returns {() => void}
   */
  subscribe(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('EventBus handler must be a function');
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event);
    handlers.add(handler);

    return () => this.unsubscribe(event, handler);
  }

  /**
   * Register a one-time listener.
   * @param {string} event
   * @param {(payload: any) => void} handler
   */
  once(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('EventBus handler must be a function');
    }

    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }

    this.onceListeners.get(event).add(handler);
  }

  /**
   * Remove a previously registered listener.
   * @param {string} event
   * @param {(payload: any) => void} handler
   */
  unsubscribe(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }

    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      onceHandlers.delete(handler);
      if (onceHandlers.size === 0) {
        this.onceListeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all listeners.
   * @param {string} event
   * @param {any} payload
   */
  publish(event, payload) {
    this._record(event, payload);

    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of [...handlers]) {
        try {
          handler(payload);
        } catch (error) {
          console.warn(`EventBus handler failed for ${event}:`, error);
        }
      }
    }

    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      for (const handler of [...onceHandlers]) {
        try {
          handler(payload);
        } catch (error) {
          console.warn(`EventBus once-handler failed for ${event}:`, error);
        }
      }
      this.onceListeners.delete(event);
    }

    this._broadcastToDom(event, payload);
  }

  /**
   * Retrieve a shallow copy of the recent history for observability.
   * @param {number} [limit]
   */
  getHistory(limit = this.maxHistory) {
    return this.history.slice(-limit);
  }

  /**
   * Internal helper to keep bounded history for debugging & telemetry.
   */
  _record(event, payload) {
    this.history.push({
      event,
      payload,
      timestamp: Date.now(),
    });

    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
  }

  /**
   * Mirror events to the DOM event system when available to loosely
   * couple UI listeners without importing the bus directly.
   */
  _broadcastToDom(event, payload) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
      return;
    }

    try {
      const domEvent = new CustomEvent(DOM_EVENT_CHANNEL, {
        detail: { event, payload },
      });
      window.dispatchEvent(domEvent);
    } catch (error) {
      // Silently ignore serialization issues (e.g., circular references)
      console.warn('EventBus DOM broadcast failed:', error);
    }
  }
}

export const eventBus = new EventBus();

export const PipelineEvents = Object.freeze({
  TASK_QUEUED: 'pipeline.task.queued',
  TASK_STARTED: 'pipeline.task.started',
  TASK_COMPLETED: 'pipeline.task.completed',
  TASK_FAILED: 'pipeline.task.failed',
  TASK_RETRYING: 'pipeline.task.retrying',
  BATCH_PROGRESS: 'pipeline.batch.progress',
  BATCH_COMPLETED: 'pipeline.batch.completed',
  PROJECT_SUCCESS: 'pipeline.project.success',
  PROJECT_FAILURE: 'pipeline.project.failure',
  PIPELINE_STATS: 'pipeline.stats.updated',
});

export const ErrorEvents = Object.freeze({
  ISOLATED: 'error.isolated',
  RECOVERED: 'error.recovered',
});

export const SystemEvents = Object.freeze({
  WORKER_HEALTH: 'system.worker.health',
  MEMORY_USAGE: 'system.memory.usage',
});

export default eventBus;

// Expose in browser/worker contexts for debugging or loose coupling
if (typeof self !== 'undefined') {
  self.AutofixEventBus = eventBus;
  self.AutofixPipelineEvents = PipelineEvents;
}
