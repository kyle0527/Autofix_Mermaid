/**
 * Phase 2 Integration Test - 測試現代化分析管道
 */

import { globalAnalysisPipeline } from './js/modern/ModernAnalysisPipeline.js';
import { globalEventBus, SystemEventTypes } from './js/modern/events/EventBus.js';

async function testPhase2Integration() {
  console.log('🧪 開始 Phase 2 整合測試...');
  
  try {
    // Test 1: 事件系統測試
    console.log('\n📡 測試事件系統...');
    let eventReceived = false;
    
    globalEventBus.on(SystemEventTypes.PIPELINE_START, (data) => {
      console.log('✅ 接收到管道啟動事件:', data.sessionId);
      eventReceived = true;
    });

    // Test 2: 快速分析測試（使用測試專案）
    console.log('\n🔍 測試分析管道...');
    const testProjectPath = './test'; // 使用測試目錄
    
    const results = await globalAnalysisPipeline.quickAnalyze(testProjectPath);
    
    console.log('\n📊 分析結果:');
    console.log('- Session ID:', results.sessionId);
    console.log('- 專案路徑:', results.projectPath);
    console.log('- 處理語言:', Object.keys(results.languages));
    console.log('- 輸出格式:', Object.keys(results.outputs));
    console.log('- 總耗時:', results.metadata.totalDuration + 'ms');
    
    // Test 3: 統一 IR 測試
    if (results.unifiedIR) {
      console.log('\n🔄 統一 IR 測試:');
      console.log('- 版本:', results.unifiedIR.version);
      console.log('- 實體數量:', results.unifiedIR.entities.size);
      console.log('- 關係數量:', results.unifiedIR.relations.size);
    }

    // Test 4: Mermaid 輸出測試
    if (results.outputs.mermaid) {
      console.log('\n📈 Mermaid 輸出測試:');
      console.log('- 圖表類型:', Object.keys(results.outputs.mermaid.diagrams));
      console.log('- 生成器:', results.outputs.mermaid.metadata?.generator || 'modern');
    }

    console.log('\n✅ Phase 2 整合測試完成！');
    console.log('🎯 事件系統:', eventReceived ? '✅ 正常' : '❌ 異常');
    console.log('🎯 分析管道:', results ? '✅ 正常' : '❌ 異常');
    console.log('🎯 統一 IR:', results.unifiedIR ? '✅ 正常' : '⚠️ 未啟用或失敗');
    console.log('🎯 輸出生成:', Object.keys(results.outputs).length > 0 ? '✅ 正常' : '❌ 異常');

    return {
      success: true,
      results,
      tests: {
        eventSystem: eventReceived,
        analysisPipeline: !!results,
        unifiedIR: !!results.unifiedIR,
        outputGeneration: Object.keys(results.outputs).length > 0
      }
    };

  } catch (error) {
    console.error('\n❌ Phase 2 整合測試失敗:', error.message);
    console.error('錯誤堆疊:', error.stack);
    
    return {
      success: false,
      error: error.message,
      tests: {
        eventSystem: false,
        analysisPipeline: false,
        unifiedIR: false,
        outputGeneration: false
      }
    };
  }
}

// 如果直接執行此腳本，運行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  testPhase2Integration().then(result => {
    console.log('\n🎉 測試完成，結果:', result);
    process.exit(result.success ? 0 : 1);
  });
}

export { testPhase2Integration };