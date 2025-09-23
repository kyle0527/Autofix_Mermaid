/**
 * Memory Management System
 * 
 * Problem 6: Memory management optimization
 * - Prevents memory leaks through automatic cleanup
 * - Implements efficient garbage collection strategies  
 * - Provides memory monitoring and alerts
 * - Manages cache lifecycles and size limits
 * - Optimizes resource allocation and deallocation
 * 
 * Dependencies: Problem 1 (WASM loader optimization) ✅
 */

// import { WASMOptimizer } from './wasm-optimization.js';

/**
 * Memory usage tracker and analyzer
 */
class MemoryTracker {
  constructor(options = {}) {
    this.options = {
      monitoringInterval: 30000, // 30 seconds
      alertThreshold: 0.85, // 85% of available memory
      enableTracking: true,
      enableProfiling: false,
      maxTrackingHistory: 100,
      ...options
    };
    
    this.stats = {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0,
      timestamp: Date.now()
    };
    
    this.history = [];
    this.alerts = [];
    this.monitoringTimer = null;
    this.listeners = new Set();
    
    console.log('Memory tracker initialized with monitoring enabled');
  }
  
  /**
   * Start memory monitoring
   */
  startMonitoring() {
    if (!this.options.enableTracking || this.monitoringTimer) {
      return;
    }
    
    this.monitoringTimer = setInterval(() => {
      this.updateStats();
      this.checkForIssues();
    }, this.options.monitoringInterval);
    
    console.log(`Memory monitoring started (interval: ${this.options.monitoringInterval}ms)`);
  }
  
  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
      console.log('Memory monitoring stopped');
    }
  }
  
  /**
   * Update memory statistics
   */
  updateStats() {
    try {
      // Browser environment
      if (typeof performance !== 'undefined' && performance.memory) {
        const memory = performance.memory;
        this.stats = {
          heapUsed: memory.usedJSHeapSize,
          heapTotal: memory.totalJSHeapSize,
          heapLimit: memory.jsHeapSizeLimit,
          external: 0,
          rss: 0,
          timestamp: Date.now()
        };
      }
      // Node.js environment
      else if (typeof process !== 'undefined' && process.memoryUsage) {
        const memory = process.memoryUsage();
        this.stats = {
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external,
          rss: memory.rss,
          timestamp: Date.now()
        };
      }
      
      // Add to history
      this.addToHistory(this.stats);
      
      // Notify listeners
      this.notifyListeners('stats-updated', this.stats);
      
    } catch (error) {
      console.warn('Failed to update memory stats:', error);
    }
  }
  
  /**
   * Add stats to history with size limit
   */
  addToHistory(stats) {
    this.history.push({ ...stats });
    
    if (this.history.length > this.options.maxTrackingHistory) {
      this.history.shift();
    }
  }
  
  /**
   * Check for memory issues and generate alerts
   */
  checkForIssues() {
    const usageRatio = this.getMemoryUsageRatio();
    
    if (usageRatio > this.options.alertThreshold) {
      const alert = {
        type: 'high-memory-usage',
        severity: 'warning',
        message: `Memory usage is ${(usageRatio * 100).toFixed(1)}% of available`,
        timestamp: Date.now(),
        stats: { ...this.stats },
        usageRatio
      };
      
      this.alerts.push(alert);
      this.notifyListeners('alert', alert);
      
      console.warn(`⚠️ Memory Alert: ${alert.message}`);
    }
    
    // Check for memory leaks (rapid growth)
    if (this.history.length >= 5) {
      const recent = this.history.slice(-5);
      const growth = this.calculateMemoryGrowth(recent);
      
      if (growth > 0.2) { // 20% growth in short time
        const alert = {
          type: 'potential-memory-leak',
          severity: 'error',
          message: `Detected ${(growth * 100).toFixed(1)}% memory growth`,
          timestamp: Date.now(),
          growth,
          recentHistory: recent
        };
        
        this.alerts.push(alert);
        this.notifyListeners('alert', alert);
        
        console.error(`🚨 Memory Leak Alert: ${alert.message}`);
      }
    }
  }
  
  /**
   * Calculate memory usage ratio
   */
  getMemoryUsageRatio() {
    if (this.stats.heapLimit) {
      return this.stats.heapUsed / this.stats.heapLimit;
    } else if (this.stats.heapTotal) {
      return this.stats.heapUsed / this.stats.heapTotal;
    }
    return 0;
  }
  
  /**
   * Calculate memory growth rate
   */
  calculateMemoryGrowth(history) {
    if (history.length < 2) return 0;
    
    const first = history[0].heapUsed;
    const last = history[history.length - 1].heapUsed;
    
    return first > 0 ? (last - first) / first : 0;
  }
  
  /**
   * Add listener for memory events
   */
  addListener(listener) {
    this.listeners.add(listener);
  }
  
  /**
   * Remove listener
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.warn('Memory listener error:', error);
      }
    });
  }
  
  /**
   * Get current memory statistics
   */
  getCurrentStats() {
    return { ...this.stats };
  }
  
  /**
   * Get memory usage summary
   */
  getSummary() {
    return {
      current: this.getCurrentStats(),
      usageRatio: this.getMemoryUsageRatio(),
      alertCount: this.alerts.length,
      historySize: this.history.length,
      monitoring: !!this.monitoringTimer
    };
  }
  
  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection() {
    try {
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
        console.log('✅ Forced garbage collection');
        return true;
      } else if (typeof window !== 'undefined' && window.gc) {
        window.gc();
        console.log('✅ Forced garbage collection');
        return true;
      } else {
        console.log('❌ Garbage collection not available');
        return false;
      }
    } catch (error) {
      console.warn('Failed to force garbage collection:', error);
      return false;
    }
  }
  
  /**
   * Clear tracking history and alerts
   */
  clearHistory() {
    this.history = [];
    this.alerts = [];
    console.log('Memory tracking history cleared');
  }
}

/**
 * Cache memory manager with lifecycle control
 */
class CacheManager {
  constructor(options = {}) {
    this.options = {
      maxTotalSize: 50 * 1024 * 1024, // 50MB
      maxItemSize: 5 * 1024 * 1024,   // 5MB
      defaultTTL: 30 * 60 * 1000,     // 30 minutes
      cleanupInterval: 5 * 60 * 1000,  // 5 minutes
      enableCompression: false,
      ...options
    };
    
    this.caches = new Map(); // name -> CacheInstance
    this.totalSize = 0;
    this.cleanupTimer = null;
    
    this.startCleanupTimer();
    console.log('Cache manager initialized');
  }
  
  /**
   * Create or get a cache instance
   */
  getCache(name, options = {}) {
    if (!this.caches.has(name)) {
      const cacheOptions = {
        maxSize: this.options.maxTotalSize / 4, // Default to 1/4 of total
        ttl: this.options.defaultTTL,
        ...options
      };
      
      this.caches.set(name, new CacheInstance(name, cacheOptions, this));
    }
    
    return this.caches.get(name);
  }
  
  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.options.cleanupInterval);
  }
  
  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  
  /**
   * Perform cache cleanup
   */
  performCleanup() {
    console.log('🧹 Starting cache cleanup...');
    
    let totalCleaned = 0;
    let totalFreed = 0;
    
    for (const [name, cache] of this.caches) {
      const cleaned = cache.cleanup();
      totalCleaned += cleaned.expired;
      totalFreed += cleaned.freedBytes;
      
      if (cache.isEmpty()) {
        this.caches.delete(name);
        console.log(`Cache '${name}' removed (empty)`);
      }
    }
    
    this.updateTotalSize();
    
    console.log(`✅ Cache cleanup completed: ${totalCleaned} items, ${this.formatBytes(totalFreed)} freed`);
    
    // Force aggressive cleanup if over limit
    if (this.totalSize > this.options.maxTotalSize) {
      this.forceCleanup();
    }
  }
  
  /**
   * Force aggressive cleanup when over memory limit
   */
  forceCleanup() {
    console.log('🔥 Performing aggressive cache cleanup...');
    
    const cacheArray = Array.from(this.caches.values());
    
    // Sort by last access time (LRU)
    cacheArray.sort((a, b) => a.lastAccessTime - b.lastAccessTime);
    
    let totalFreed = 0;
    
    for (const cache of cacheArray) {
      if (this.totalSize <= this.options.maxTotalSize * 0.8) {
        break; // Target 80% of max size
      }
      
      const freed = cache.forceCleanup();
      totalFreed += freed;
      this.updateTotalSize();
    }
    
    console.log(`🔥 Aggressive cleanup freed ${this.formatBytes(totalFreed)}`);
  }
  
  /**
   * Update total cache size
   */
  updateTotalSize() {
    this.totalSize = 0;
    for (const cache of this.caches.values()) {
      this.totalSize += cache.getCurrentSize();
    }
  }
  
  /**
   * Get cache statistics
   */
  getStatistics() {
    const cacheStats = {};
    let totalItems = 0;
    let totalHits = 0;
    let totalMisses = 0;
    
    for (const [name, cache] of this.caches) {
      const stats = cache.getStatistics();
      cacheStats[name] = stats;
      totalItems += stats.itemCount;
      totalHits += stats.hits;
      totalMisses += stats.misses;
    }
    
    return {
      totalCaches: this.caches.size,
      totalItems,
      totalSize: this.totalSize,
      totalSizeFormatted: this.formatBytes(this.totalSize),
      maxSize: this.options.maxTotalSize,
      maxSizeFormatted: this.formatBytes(this.options.maxTotalSize),
      utilizationPercent: (this.totalSize / this.options.maxTotalSize) * 100,
      hitRate: totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0,
      caches: cacheStats
    };
  }
  
  /**
   * Clear all caches
   */
  clearAll() {
    let totalCleared = 0;
    
    for (const cache of this.caches.values()) {
      totalCleared += cache.clear();
    }
    
    this.totalSize = 0;
    console.log(`All caches cleared: ${totalCleared} items`);
    
    return totalCleared;
  }
  
  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopCleanupTimer();
    this.clearAll();
    this.caches.clear();
    console.log('Cache manager cleaned up');
  }
}

/**
 * Individual cache instance
 */
class CacheInstance {
  constructor(name, options, manager) {
    this.name = name;
    this.options = options;
    this.manager = manager;
    
    this.data = new Map();
    this.sizes = new Map(); // key -> size in bytes
    this.accessTimes = new Map(); // key -> last access timestamp
    this.createTimes = new Map(); // key -> creation timestamp
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      expires: 0
    };
    
    this.lastAccessTime = Date.now();
  }
  
  /**
   * Get item from cache
   */
  get(key) {
    this.lastAccessTime = Date.now();
    
    if (!this.data.has(key)) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check TTL
    const createTime = this.createTimes.get(key);
    if (Date.now() - createTime > this.options.ttl) {
      this.delete(key);
      this.stats.misses++;
      this.stats.expires++;
      return undefined;
    }
    
    this.accessTimes.set(key, Date.now());
    this.stats.hits++;
    
    return this.data.get(key);
  }
  
  /**
   * Set item in cache
   */
  set(key, value) {
    this.lastAccessTime = Date.now();
    
    // Calculate size
    const size = this.calculateSize(value);
    
    if (size > this.manager.options.maxItemSize) {
      console.warn(`Item too large for cache: ${this.manager.formatBytes(size)}`);
      return false;
    }
    
    // Remove existing item if present
    if (this.data.has(key)) {
      this.delete(key);
    }
    
    // Check if cache has room
    const currentSize = this.getCurrentSize();
    if (currentSize + size > this.options.maxSize) {
      // Try to make room by cleaning up expired items
      this.cleanup();
      
      if (this.getCurrentSize() + size > this.options.maxSize) {
        // Still no room, remove LRU items
        this.evictLRU(size);
      }
    }
    
    // Add item
    const now = Date.now();
    this.data.set(key, value);
    this.sizes.set(key, size);
    this.accessTimes.set(key, now);
    this.createTimes.set(key, now);
    
    this.stats.sets++;
    this.manager.updateTotalSize();
    
    return true;
  }
  
  /**
   * Delete item from cache
   */
  delete(key) {
    if (!this.data.has(key)) {
      return false;
    }
    
    this.data.delete(key);
    this.sizes.delete(key);
    this.accessTimes.delete(key);
    this.createTimes.delete(key);
    
    this.stats.deletes++;
    this.manager.updateTotalSize();
    
    return true;
  }
  
  /**
   * Check if cache has key
   */
  has(key) {
    this.lastAccessTime = Date.now();
    
    if (!this.data.has(key)) {
      return false;
    }
    
    // Check TTL
    const createTime = this.createTimes.get(key);
    if (Date.now() - createTime > this.options.ttl) {
      this.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculate size of value in bytes
   */
  calculateSize(value) {
    try {
      if (typeof value === 'string') {
        return new TextEncoder().encode(value).length;
      } else if (value instanceof ArrayBuffer) {
        return value.byteLength;
      } else if (ArrayBuffer.isView(value)) {
        return value.byteLength;
      } else {
        // Rough estimation for objects
        const json = JSON.stringify(value);
        return new TextEncoder().encode(json).length;
      }
    } catch (error) {
      // Fallback estimation
      return 100; // 100 bytes default
    }
  }
  
  /**
   * Get current cache size
   */
  getCurrentSize() {
    let total = 0;
    for (const size of this.sizes.values()) {
      total += size;
    }
    return total;
  }
  
  /**
   * Cleanup expired items
   */
  cleanup() {
    const now = Date.now();
    let expired = 0;
    let freedBytes = 0;
    
    for (const [key, createTime] of this.createTimes) {
      if (now - createTime > this.options.ttl) {
        const size = this.sizes.get(key) || 0;
        freedBytes += size;
        this.delete(key);
        expired++;
        this.stats.expires++;
      }
    }
    
    return { expired, freedBytes };
  }
  
  /**
   * Evict LRU items to make room
   */
  evictLRU(neededSize) {
    const items = Array.from(this.accessTimes.entries())
      .sort((a, b) => a[1] - b[1]); // Sort by access time (oldest first)
    
    let freedBytes = 0;
    
    for (const [key] of items) {
      const size = this.sizes.get(key) || 0;
      this.delete(key);
      freedBytes += size;
      
      if (freedBytes >= neededSize) {
        break;
      }
    }
    
    return freedBytes;
  }
  
  /**
   * Force cleanup (remove half of items)
   */
  forceCleanup() {
    const items = Array.from(this.accessTimes.entries())
      .sort((a, b) => a[1] - b[1]); // Sort by access time (oldest first)
    
    const toRemove = Math.ceil(items.length / 2);
    let freedBytes = 0;
    
    for (let i = 0; i < toRemove && i < items.length; i++) {
      const key = items[i][0];
      const size = this.sizes.get(key) || 0;
      this.delete(key);
      freedBytes += size;
    }
    
    return freedBytes;
  }
  
  /**
   * Clear all items
   */
  clear() {
    const count = this.data.size;
    
    this.data.clear();
    this.sizes.clear();
    this.accessTimes.clear();
    this.createTimes.clear();
    
    this.manager.updateTotalSize();
    
    return count;
  }
  
  /**
   * Check if cache is empty
   */
  isEmpty() {
    return this.data.size === 0;
  }
  
  /**
   * Get cache statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      itemCount: this.data.size,
      currentSize: this.getCurrentSize(),
      maxSize: this.options.maxSize,
      utilizationPercent: (this.getCurrentSize() / this.options.maxSize) * 100,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
        : 0,
      ttl: this.options.ttl,
      lastAccess: this.lastAccessTime
    };
  }
}

/**
 * Resource manager for various system resources
 */
class ResourceManager {
  constructor(memoryTracker, cacheManager) {
    this.memoryTracker = memoryTracker;
    this.cacheManager = cacheManager;
    
    this.resources = new Map(); // resource_id -> resource_info
    this.resourceTypes = new Map(); // type -> cleanup_handler
    this.cleanupScheduled = false;
    
    this.registerDefaultResourceTypes();
    console.log('Resource manager initialized');
  }
  
  /**
   * Register default resource types
   */
  registerDefaultResourceTypes() {
    // Event listeners
    this.registerResourceType('event-listener', (resource) => {
      if (resource.target && resource.event && resource.handler) {
        resource.target.removeEventListener(resource.event, resource.handler);
      }
    });
    
    // Timers
    this.registerResourceType('timer', (resource) => {
      if (resource.timerId) {
        clearTimeout(resource.timerId);
      }
    });
    
    // Intervals
    this.registerResourceType('interval', (resource) => {
      if (resource.intervalId) {
        clearInterval(resource.intervalId);
      }
    });
    
    // Web Workers
    this.registerResourceType('worker', (resource) => {
      if (resource.worker && resource.worker.terminate) {
        resource.worker.terminate();
      }
    });
    
    // WASM modules
    this.registerResourceType('wasm', (resource) => {
      if (resource.module && resource.module.cleanup) {
        resource.module.cleanup();
      }
    });
  }
  
  /**
   * Register a resource type with cleanup handler
   */
  registerResourceType(type, cleanupHandler) {
    this.resourceTypes.set(type, cleanupHandler);
  }
  
  /**
   * Register a resource for management
   */
  registerResource(id, type, resource, metadata = {}) {
    this.resources.set(id, {
      id,
      type,
      resource,
      metadata,
      createdAt: Date.now(),
      lastUsed: Date.now()
    });
    
    // Schedule cleanup check
    this.scheduleCleanup();
  }
  
  /**
   * Unregister and cleanup a resource
   */
  unregisterResource(id) {
    const resourceInfo = this.resources.get(id);
    if (!resourceInfo) {
      return false;
    }
    
    this.cleanupResource(resourceInfo);
    this.resources.delete(id);
    
    return true;
  }
  
  /**
   * Update resource last used time
   */
  updateResourceUsage(id) {
    const resourceInfo = this.resources.get(id);
    if (resourceInfo) {
      resourceInfo.lastUsed = Date.now();
    }
  }
  
  /**
   * Cleanup a specific resource
   */
  cleanupResource(resourceInfo) {
    const handler = this.resourceTypes.get(resourceInfo.type);
    if (handler) {
      try {
        handler(resourceInfo.resource);
      } catch (error) {
        console.warn(`Failed to cleanup resource ${resourceInfo.id}:`, error);
      }
    }
  }
  
  /**
   * Schedule periodic cleanup
   */
  scheduleCleanup() {
    if (this.cleanupScheduled) return;
    
    this.cleanupScheduled = true;
    
    // Use setTimeout to avoid blocking
    setTimeout(() => {
      this.performResourceCleanup();
      this.cleanupScheduled = false;
    }, 1000);
  }
  
  /**
   * Perform resource cleanup
   */
  performResourceCleanup() {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    
    let cleanedCount = 0;
    
    for (const [id, resourceInfo] of this.resources) {
      // Cleanup stale resources
      if (now - resourceInfo.lastUsed > staleThreshold) {
        this.cleanupResource(resourceInfo);
        this.resources.delete(id);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} stale resources`);
    }
  }
  
  /**
   * Cleanup all resources
   */
  cleanupAll() {
    let cleanedCount = 0;
    
    for (const resourceInfo of this.resources.values()) {
      this.cleanupResource(resourceInfo);
      cleanedCount++;
    }
    
    this.resources.clear();
    console.log(`🧹 Cleaned up all ${cleanedCount} resources`);
    
    return cleanedCount;
  }
  
  /**
   * Get resource statistics
   */
  getStatistics() {
    const stats = {
      totalResources: this.resources.size,
      byType: {},
      oldestResource: null,
      newestResource: null
    };
    
    let oldestTime = Infinity;
    let newestTime = 0;
    
    for (const resourceInfo of this.resources.values()) {
      // Count by type
      stats.byType[resourceInfo.type] = (stats.byType[resourceInfo.type] || 0) + 1;
      
      // Track oldest and newest
      if (resourceInfo.createdAt < oldestTime) {
        oldestTime = resourceInfo.createdAt;
        stats.oldestResource = resourceInfo.id;
      }
      
      if (resourceInfo.createdAt > newestTime) {
        newestTime = resourceInfo.createdAt;
        stats.newestResource = resourceInfo.id;
      }
    }
    
    return stats;
  }
}

/**
 * Main memory management coordinator
 */
class MemoryManager {
  constructor(options = {}) {
    this.options = {
      enableMonitoring: true,
      enableCacheManagement: true,
      enableResourceTracking: true,
      autoCleanup: true,
      ...options
    };
    
    // Initialize components
    this.memoryTracker = new MemoryTracker(options.memoryTracker);
    this.cacheManager = new CacheManager(options.cacheManager);
    this.resourceManager = new ResourceManager(this.memoryTracker, this.cacheManager);
    
    // Start monitoring if enabled
    if (this.options.enableMonitoring) {
      this.memoryTracker.startMonitoring();
    }
    
    // Set up memory alerts handling
    this.memoryTracker.addListener((event, data) => {
      if (event === 'alert' && this.options.autoCleanup) {
        this.handleMemoryAlert(data);
      }
    });
    
    console.log('Memory manager initialized');
  }
  
  /**
   * Handle memory alerts with automatic cleanup
   */
  handleMemoryAlert(alert) {
    console.log(`🚨 Handling memory alert: ${alert.type}`);
    
    if (alert.type === 'high-memory-usage') {
      // Trigger cache cleanup
      this.cacheManager.performCleanup();
      
      // Force garbage collection if available
      this.memoryTracker.forceGarbageCollection();
      
    } else if (alert.type === 'potential-memory-leak') {
      // More aggressive cleanup
      this.cacheManager.forceCleanup();
      this.resourceManager.performResourceCleanup();
      
      // Clear old tracking data
      this.memoryTracker.clearHistory();
    }
  }
  
  /**
   * Get cache for specific purpose
   */
  getCache(name, options) {
    return this.cacheManager.getCache(name, options);
  }
  
  /**
   * Register resource for tracking
   */
  registerResource(id, type, resource, metadata) {
    this.resourceManager.registerResource(id, type, resource, metadata);
  }
  
  /**
   * Unregister resource
   */
  unregisterResource(id) {
    return this.resourceManager.unregisterResource(id);
  }
  
  /**
   * Get comprehensive memory statistics
   */
  getStatistics() {
    return {
      memory: this.memoryTracker.getSummary(),
      cache: this.cacheManager.getStatistics(),
      resources: this.resourceManager.getStatistics(),
      alerts: this.memoryTracker.alerts.length,
      timestamp: Date.now()
    };
  }
  
  /**
   * Perform complete system cleanup
   */
  performFullCleanup() {
    console.log('🧹 Performing full memory cleanup...');
    
    const startStats = this.getStatistics();
    
    // Clean caches
    const cachesCleaned = this.cacheManager.clearAll();
    
    // Clean resources  
    const resourcesCleaned = this.resourceManager.cleanupAll();
    
    // Force garbage collection
    const gcPerformed = this.memoryTracker.forceGarbageCollection();
    
    // Clear tracking history
    this.memoryTracker.clearHistory();
    
    const endStats = this.getStatistics();
    
    console.log('✅ Full cleanup completed:', {
      cachesCleaned,
      resourcesCleaned,
      gcPerformed,
      memoryBefore: startStats.memory.current.heapUsed,
      memoryAfter: endStats.memory.current.heapUsed
    });
    
    return {
      cachesCleaned,
      resourcesCleaned,
      gcPerformed,
      memoryFreed: startStats.memory.current.heapUsed - endStats.memory.current.heapUsed
    };
  }
  
  /**
   * Cleanup and shutdown memory management
   */
  cleanup() {
    console.log('🧹 Shutting down memory manager...');
    
    this.memoryTracker.stopMonitoring();
    this.cacheManager.cleanup();
    this.resourceManager.cleanupAll();
    
    console.log('✅ Memory manager shutdown complete');
  }
}

// Export classes and create default instance
export {
  MemoryTracker,
  CacheManager,
  ResourceManager, 
  MemoryManager
};

// Create global memory manager instance
export const memoryManager = new MemoryManager({
  enableMonitoring: true,
  enableCacheManagement: true,
  enableResourceTracking: true,
  autoCleanup: true
});

// Integration with existing WASM optimization (to be implemented in Problem 1)
// if (typeof wasmOptimization !== 'undefined') {
//   // Register WASM resources with memory manager
//   memoryManager.registerResource(
//     'wasm-loader',
//     'wasm',
//     wasmOptimization,
//     { component: 'wasm-optimization' }
//   );
// }

console.log('Memory management system loaded successfully');