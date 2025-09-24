# 立即可執行：現代框架升級 PoC

## 🎯 **今日可開始的升級 Proof of Concept**

### **Step 1: 評估現有架構優勢**
```bash
# 檢查現有優秀設計
echo "=== 現有 TypeScript 核心架構 ==="
ls -la engine-src/packages/
echo "✅ 已有完整 monorepo 結構"

echo "=== 現有依賴分析 ==="  
npm list tree-sitter eventemitter3 zustand 2>/dev/null || echo "需要升級依賴"
```

### **Step 2: 建立現代化開發環境**
```bash
# 在現有專案中建立現代化開發分支
git checkout -b feature/modern-architecture-poc

# 升級 package.json - 保留現有，增加現代工具
npm install --save-dev nx @nx/js @nx/vite vitest
npm install zustand valtio eventemitter3 comlink
npm install --save-dev @tanstack/react-query # 如果選擇 React UI
```

### **Step 3: 創建現代化 PoC 結構**
```typescript
// 建立現代化事件系統 PoC
// modern/events/EventBus.ts
import { EventEmitter } from 'eventemitter3'
import { fromEvent, Observable } from 'rxjs'
import { map, filter } from 'rxjs/operators'

export interface PipelineEvents {
  'pipeline:started': { projectId: string; files: string[] }
  'pipeline:progress': { projectId: string; progress: number }
  'pipeline:completed': { projectId: string; result: any }
  'error:recoverable': { error: Error; context: any }
  'error:fatal': { error: Error; context: any }
}

export class ModernEventBus extends EventEmitter<PipelineEvents> {
  // 響應式事件流
  pipeline$: Observable<any> = fromEvent(this as any, 'pipeline:*').pipe(
    filter((event: any) => event.type?.startsWith('pipeline:')),
    map((event: any) => event.data)
  )

  error$: Observable<any> = fromEvent(this as any, 'error:*').pipe(
    filter((event: any) => event.type?.startsWith('error:')),
    map((event: any) => event.data)
  )

  // 型別安全的事件發射
  emitPipelineStarted(data: PipelineEvents['pipeline:started']) {
    this.emit('pipeline:started', data)
    this.broadcastToDOM('pipeline:started', data)
  }

  emitPipelineProgress(data: PipelineEvents['pipeline:progress']) {
    this.emit('pipeline:progress', data)
    this.broadcastToDOM('pipeline:progress', data)
  }

  private broadcastToDOM(type: string, data: any) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(`autofix:${type}`, { detail: data })
      )
    }
  }
}

export const globalEventBus = new ModernEventBus()
```

### **Step 4: Worker 通訊現代化**
```typescript
// modern/workers/ProcessingWorker.ts
import * as Comlink from 'comlink'
import { MermaidProcessingPipeline } from '../../js/engine/async-pipeline-integration.js'
import { ErrorPropagationManager } from '../../js/engine/error-propagation.js'
import { globalEventBus } from '../events/EventBus.js'

class ModernProcessingWorker {
  private pipeline: MermaidProcessingPipeline
  private errorManager: ErrorPropagationManager

  constructor() {
    // 保留現有邏輯，升級通訊方式
    this.pipeline = new MermaidProcessingPipeline({
      maxConcurrent: 4,
      enableMetrics: true
    })
    
    this.errorManager = new ErrorPropagationManager()
    
    // 連接到事件系統
    this.setupEventHandlers()
  }

  // 簡化的 API - 直接調用，無需序列化煩惱
  async processProject(files: string[], options: any = {}) {
    try {
      globalEventBus.emitPipelineStarted({ 
        projectId: options.projectId || 'default',
        files 
      })

      const result = await this.pipeline.processProject(files, options)
      
      globalEventBus.emit('pipeline:completed', {
        projectId: options.projectId || 'default',
        result
      })

      return result
    } catch (error) {
      this.errorManager.propagateError(error as Error, { files, options })
      
      globalEventBus.emit('error:recoverable', { 
        error: error as Error, 
        context: { files, options } 
      })
      
      throw error
    }
  }

  async getProcessingStats() {
    return this.pipeline.getProcessingStats()
  }

  async getMemoryStats() {
    return this.pipeline.getMemoryStats()
  }

  private setupEventHandlers() {
    // 監聽內部事件並轉發
    this.pipeline.on?.('progress', (progress) => {
      globalEventBus.emitPipelineProgress({
        projectId: 'current',
        progress: progress.percentage
      })
    })
  }
}

// Comlink 自動處理序列化
Comlink.expose(ModernProcessingWorker)
```

### **Step 5: 狀態管理現代化**
```typescript
// modern/stores/AppStore.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { proxy } from 'valtio'

// 應用程式核心狀態
interface AppState {
  // 保留現有狀態結構
  currentProject: string | null
  processingStats: any | null
  errors: Error[]
  isProcessing: boolean

  // Actions
  setCurrentProject: (project: string | null) => void
  updateProcessingStats: (stats: any) => void
  addError: (error: Error) => void
  clearErrors: () => void
  setProcessing: (processing: boolean) => void
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // 初始狀態
    currentProject: null,
    processingStats: null,
    errors: [],
    isProcessing: false,

    // Actions 保持現有邏輯相容
    setCurrentProject: (project) => set({ currentProject: project }),
    
    updateProcessingStats: (stats) => set({ processingStats: stats }),
    
    addError: (error) => set((state) => ({ 
      errors: [...state.errors, error] 
    })),
    
    clearErrors: () => set({ errors: [] }),
    
    setProcessing: (processing) => set({ isProcessing: processing })
  }))
)

// UI 層響應式狀態 (Valtio)
export const uiState = proxy({
  diagramCode: '',
  selectedDiagramType: 'flowchart',
  panelExpanded: true,
  theme: 'light'
})

// 連接事件系統到狀態管理
import { globalEventBus } from '../events/EventBus.js'

globalEventBus.on('pipeline:started', () => {
  useAppStore.getState().setProcessing(true)
})

globalEventBus.on('pipeline:completed', (data) => {
  useAppStore.getState().setProcessing(false)
  // 保持現有處理邏輯
})

globalEventBus.on('error:recoverable', (data) => {
  useAppStore.getState().addError(data.error)
})
```

### **Step 6: 現代化 UI 整合**
```typescript
// modern/ui/DiagramEditor.ts
import { LitElement, html, css } from 'lit'
import { property, state } from 'lit/decorators.js'
import { useAppStore, uiState } from '../stores/AppStore.js'
import { globalEventBus } from '../events/EventBus.js'
import * as Comlink from 'comlink'

// 現代化 Web Component，保留現有 UI 結構
export class ModernDiagramEditor extends LitElement {
  @property({ type: String })
  projectPath = ''

  @state()
  private processingWorker: any

  static styles = css`
    /* 保留現有 CSS 樣式 */
    .editor-container { 
      display: flex; 
      height: 100vh; 
    }
    .editor-panel { 
      flex: 1; 
      border-right: 1px solid #ddd; 
    }
    .preview-panel { 
      flex: 1; 
    }
  `

  async connectedCallback() {
    super.connectedCallback()
    
    // 初始化現代化 Worker
    this.processingWorker = Comlink.wrap(
      new Worker(new URL('../workers/processing-worker.ts', import.meta.url), {
        type: 'module'
      })
    )

    // 監聽事件更新
    this.subscribeToEvents()
  }

  private subscribeToEvents() {
    // 使用現代事件系統
    globalEventBus.on('pipeline:progress', (data) => {
      this.requestUpdate() // 觸發重新渲染
    })

    globalEventBus.on('pipeline:completed', (data) => {
      // 保留現有 UI 更新邏輯
      uiState.diagramCode = data.result.mermaidCode || ''
      this.requestUpdate()
    })
  }

  render() {
    return html`
      <div class="editor-container">
        <!-- 保留現有 HTML 結構，增強互動性 -->
        <div class="editor-panel">
          <textarea
            .value=${uiState.diagramCode}
            @input=${this.onCodeChange}
            placeholder="Mermaid diagram code will appear here..."
          ></textarea>
          
          <div class="controls">
            <button 
              @click=${this.processProject}
              ?disabled=${useAppStore.getState().isProcessing}
            >
              ${useAppStore.getState().isProcessing ? 'Processing...' : 'Generate Diagram'}
            </button>
          </div>
        </div>

        <div class="preview-panel">
          <div id="mermaid-preview">
            <!-- Mermaid 渲染區域 -->
          </div>
        </div>
      </div>
    `
  }

  private onCodeChange(e: Event) {
    const target = e.target as HTMLTextAreaElement
    uiState.diagramCode = target.value
  }

  private async processProject() {
    if (!this.projectPath) return

    try {
      // 使用現代化 Worker API - 簡單如本地調用
      const result = await this.processingWorker.processProject(
        [this.projectPath],
        { projectId: `project-${Date.now()}` }
      )
      
      console.log('Processing completed:', result)
    } catch (error) {
      console.error('Processing failed:', error)
    }
  }
}

// 註冊 Web Component
customElements.define('modern-diagram-editor', ModernDiagramEditor)
```

### **Step 7: 整合測試**
```typescript
// modern/tests/integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { ModernEventBus } from '../events/EventBus.js'
import { useAppStore } from '../stores/AppStore.js'

describe('現代化架構整合測試', () => {
  let eventBus: ModernEventBus

  beforeEach(() => {
    eventBus = new ModernEventBus()
  })

  it('應該正確處理 pipeline 事件流', async () => {
    const events: string[] = []
    
    eventBus.on('pipeline:started', () => events.push('started'))
    eventBus.on('pipeline:progress', () => events.push('progress'))
    eventBus.on('pipeline:completed', () => events.push('completed'))

    // 模擬事件流
    eventBus.emitPipelineStarted({ projectId: 'test', files: ['test.js'] })
    eventBus.emit('pipeline:progress', { projectId: 'test', progress: 50 })
    eventBus.emit('pipeline:completed', { projectId: 'test', result: {} })

    expect(events).toEqual(['started', 'progress', 'completed'])
  })

  it('應該正確管理應用程式狀態', () => {
    const store = useAppStore.getState()
    
    expect(store.isProcessing).toBe(false)
    
    store.setProcessing(true)
    expect(useAppStore.getState().isProcessing).toBe(true)
    
    store.addError(new Error('Test error'))
    expect(useAppStore.getState().errors).toHaveLength(1)
  })
})
```

---

## 🚀 **立即執行腳本**

```bash
#!/bin/bash
# setup-modern-architecture.sh

echo "🎯 AutoFix Mermaid 現代化架構升級"
echo "=================================="

echo "📋 Step 1: 建立開發分支"
git checkout -b feature/modern-architecture-upgrade

echo "📋 Step 2: 安裝現代化依賴"
npm install --save-dev nx @nx/js @nx/vite vitest
npm install zustand valtio eventemitter3 comlink rxjs lit
npm install --save-dev @types/node

echo "📋 Step 3: 建立現代化目錄結構"
mkdir -p modern/{events,workers,stores,ui,tests}

echo "📋 Step 4: 建立基礎配置檔案"
# vite.config.ts
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'

export default defineConfig({
  root: './modern',
  build: {
    lib: {
      entry: 'index.ts',
      formats: ['es']
    }
  },
  worker: {
    format: 'es'
  }
})
EOF

# vitest.config.ts  
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
EOF

echo "📋 Step 5: 更新 package.json scripts"
npm pkg set scripts.dev:modern="vite serve modern"
npm pkg set scripts.build:modern="vite build"  
npm pkg set scripts.test:modern="vitest run modern/tests"

echo "✅ 現代化架構基礎設置完成！"
echo ""
echo "🚀 下一步："
echo "1. 複製上面的程式碼到對應檔案"
echo "2. 執行: npm run dev:modern"
echo "3. 開始漸進式遷移現有邏輯"
```

## 🎯 **現代框架選擇總結**

**推薦組合**：**Nx + Zustand + EventEmitter3 + Comlink + Vitest + Vite**

**為什麼這個組合最適合您的專案**：

1. **保留現有優勢**：完全相容現有 TypeScript monorepo 結構
2. **漸進升級**：可以邊用邊升級，不需要停機重寫
3. **輕量現代**：避免重型框架，保持專案敏捷
4. **型別安全**：完全 TypeScript 支援，減少運行時錯誤
5. **開發體驗**：熱重載、快速測試、智能補全

**這就是智能重構的最佳實踐：保留精華，升級工具，增強體驗！** 🚀