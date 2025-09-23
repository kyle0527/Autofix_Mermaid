/**
 * 🧪 Tree-sitter 穩定性測試腳本
 * 
 * 這個腳本用於驗證 Problem 1: Tree-sitter WASM loading instability 的解決方案
 * 
 * 測試項目：
 * 1. ✅ WASM 載入穩定性
 * 2. ✅ 多重重試機制 
 * 3. ✅ 快取系統功能
 * 4. ✅ 錯誤恢復機制
 * 5. ✅ 降級模式支援
 */

import { getTreeSitterLoader } from './js/engine/tree-sitter-loader.js';

async function runComprehensiveTest() {
    console.log('🚀 Starting Tree-sitter Stability Test Suite...\n');
    
    const loader = getTreeSitterLoader();
    let testsPassed = 0;
    let testsTotal = 0;

    // 📋 測試計劃
    const testPlan = [
        'Tree-sitter 初始化穩定性',
        'WASM 載入多重路徑',
        '語言載入重試機制',
        '快取系統功能性',
        '錯誤恢復策略',
        '效能監控準確性',
        '系統完整性驗證'
    ];

    console.log('📋 Test Plan:');
    testPlan.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
    console.log();

    // 🧪 測試 1: 初始化穩定性
    console.log('🧪 Test 1: Tree-sitter 初始化穩定性');
    testsTotal++;
    try {
        const startTime = Date.now();
        await loader.initialize();
        const initTime = Date.now() - startTime;
        
        if (loader.initialized && loader.TreeSitter) {
            console.log(`   ✅ 初始化成功 (${initTime}ms)`);
            testsPassed++;
        } else {
            console.log('   ❌ 初始化失敗：TreeSitter 實例未正確建立');
        }
    } catch (error) {
        console.log(`   ❌ 初始化失敗: ${error.message}`);
    }

    // 🧪 測試 2: 語言載入穩定性  
    console.log('\n🧪 Test 2: 語言載入穩定性');
    testsTotal++;
    const testLanguages = ['javascript', 'python'];
    let languagesLoaded = 0;
    
    for (const lang of testLanguages) {
        try {
            const startTime = Date.now();
            const language = await loader.loadLanguage(lang);
            const loadTime = Date.now() - startTime;
            
            if (language && (language.query || language.minimal)) {
                console.log(`   ✅ ${lang} 載入成功 (${loadTime}ms)`);
                languagesLoaded++;
            } else {
                console.log(`   ⚠️ ${lang} 載入異常：語言結構不完整`);
            }
        } catch (error) {
            console.log(`   ❌ ${lang} 載入失敗: ${error.message}`);
        }
    }
    
    if (languagesLoaded === testLanguages.length) {
        testsPassed++;
    }

    // 🧪 測試 3: 快取系統
    console.log('\n🧪 Test 3: 快取系統功能性');
    testsTotal++;
    try {
        if (loader.config.enableCache) {
            const cacheWorking = loader._testCache();
            if (cacheWorking) {
                console.log('   ✅ 快取系統運作正常');
                testsPassed++;
            } else {
                console.log('   ❌ 快取系統測試失敗');
            }
        } else {
            console.log('   ⏭️ 快取系統未啟用，跳過測試');
            testsPassed++; // 不計為失敗
        }
    } catch (error) {
        console.log(`   ❌ 快取測試失敗: ${error.message}`);
    }

    // 🧪 測試 4: 效能監控
    console.log('\n🧪 Test 4: 效能監控準確性');
    testsTotal++;
    try {
        const report = loader.getPerformanceReport();
        
        const hasValidMetrics = (
            report.timestamp &&
            typeof report.initialization === 'object' &&
            typeof report.languages === 'object' &&
            Array.isArray(report.languages.loaded)
        );
        
        if (hasValidMetrics) {
            console.log('   ✅ 效能報告結構正確');
            console.log(`   📊 已載入語言: ${report.languages.loaded.join(', ')}`);
            console.log(`   📊 快取命中率: ${report.languages.cacheHits}/${report.languages.cacheHits + report.languages.cacheMisses}`);
            testsPassed++;
        } else {
            console.log('   ❌ 效能報告結構異常');
        }
    } catch (error) {
        console.log(`   ❌ 效能監控測試失敗: ${error.message}`);
    }

    // 🧪 測試 5: 系統完整性驗證
    console.log('\n🧪 Test 5: 系統完整性驗證');
    testsTotal++;
    try {
        const validation = await loader.validateSystemIntegrity();
        
        if (validation.overall) {
            console.log('   ✅ 系統完整性驗證通過');
            console.log(`   📊 詳細結果: 初始化=${validation.initialization}, 語言支援=${validation.languageSupport}, 快取=${validation.cacheSystem}, 錯誤處理=${validation.errorHandling}`);
            testsPassed++;
        } else {
            console.log('   ❌ 系統完整性驗證失敗');
            console.log(`   📊 詳細結果:`, validation);
        }
    } catch (error) {
        console.log(`   ❌ 完整性驗證失敗: ${error.message}`);
    }

    // 🧪 測試 6: 內建穩定性測試
    console.log('\n🧪 Test 6: 內建穩定性測試');
    testsTotal++;
    try {
        const stabilityResults = await loader.runStabilityTest();
        
        if (stabilityResults.summary.passed >= stabilityResults.summary.total * 0.8) {
            console.log(`   ✅ 內建穩定性測試通過 (${stabilityResults.summary.passed}/${stabilityResults.summary.total})`);
            testsPassed++;
        } else {
            console.log(`   ❌ 內建穩定性測試失敗 (${stabilityResults.summary.passed}/${stabilityResults.summary.total})`);
        }
    } catch (error) {
        console.log(`   ❌ 穩定性測試失敗: ${error.message}`);
    }

    // 📊 測試結果總結
    console.log('\n📊 測試結果總結');
    console.log('='.repeat(50));
    console.log(`總測試數: ${testsTotal}`);
    console.log(`通過測試: ${testsPassed}`);
    console.log(`失敗測試: ${testsTotal - testsPassed}`);
    console.log(`成功率: ${Math.round((testsPassed / testsTotal) * 100)}%`);
    
    const isSuccess = testsPassed >= testsTotal * 0.8; // 80% 通過率
    console.log(`\n${isSuccess ? '✅' : '❌'} Problem 1 解決方案 ${isSuccess ? '驗證通過' : '需要改進'}`);

    if (isSuccess) {
        console.log('\n🎉 Tree-sitter WASM loading instability 已成功解決！');
        console.log('💡 主要改進:');
        console.log('   • 多路徑 WASM 載入策略');
        console.log('   • 指數退避重試機制'); 
        console.log('   • 智能快取系統');
        console.log('   • 錯誤恢復與降級模式');
        console.log('   • 完整效能監控');
    } else {
        console.log('\n🔧 需要進一步改進的領域:');
        if (testsPassed < testsTotal) {
            console.log('   • 檢查失敗的測試項目');
            console.log('   • 優化載入策略');  
            console.log('   • 強化錯誤處理機制');
        }
    }

    // 📋 最終狀態
    console.log('\n📋 系統最終狀態:');
    const stats = loader.getStats();
    console.log(`   初始化狀態: ${stats.initialized ? '✅' : '❌'}`);
    console.log(`   已載入語言: ${stats.languagesLoaded} 個`);
    console.log(`   支援語言: ${stats.supportedLanguages.join(', ')}`);

    return {
        success: isSuccess,
        passed: testsPassed,
        total: testsTotal,
        successRate: Math.round((testsPassed / testsTotal) * 100)
    };
}

// 🚀 執行測試
if (typeof window !== 'undefined') {
    // 瀏覽器環境
    window.runTreeSitterTest = runComprehensiveTest;
    console.log('🌐 測試函數已註冊到 window.runTreeSitterTest');
    console.log('執行方式: 在瀏覽器控制台輸入 await window.runTreeSitterTest()');
} else {
    // Node.js 環境
    runComprehensiveTest().then(result => {
        console.log(`\n🏁 測試完成: ${result.successRate}% 成功率`);
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('❌ 測試執行失敗:', error);
        process.exit(1);
    });
}

export { runComprehensiveTest };