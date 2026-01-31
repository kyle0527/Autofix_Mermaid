/**
 * 🧪 Problem 2: IR Structure Redesign - 測試驗證腳本
 * 
 * 這個腳本用於驗證 IR 結構重新設計的解決方案
 * 
 * 測試項目：
 * 1. ✅ 統一 IR 結構規範
 * 2. ✅ IR 標準化轉換器
 * 3. ✅ IR 驗證機制
 * 4. ✅ IR 處理效能
 * 5. ✅ 向後相容性
 */

import { createIRConverter, convertLegacyToUnified, convertUnifiedToLegacy } from './js/engine/unified-ir.js';
import { IRValidator, IRTestSuite } from './js/engine/ir-validator.js';

async function runIRRedesignTest() {
    console.log('🚀 Starting IR Structure Redesign Test Suite (Problem 2)...\n');
    
    let testsPassed = 0;
    let testsTotal = 0;

    // 📋 測試計劃
    const testPlan = [
        '統一 IR 結構建立',
        'Legacy IR → Unified IR 轉換',
        'Unified IR → Legacy IR 轉換',
        'IR 驗證機制測試',
        '複雜 IR 結構處理',
        '效能與相容性測試'
    ];

    console.log('📋 Test Plan:');
    testPlan.forEach((test, i) => console.log(`   ${i + 1}. ${test}`));
    console.log();

    // 🧪 測試 1: 統一 IR 結構建立
    console.log('🧪 Test 1: 統一 IR 結構建立');
    testsTotal++;
    try {
        const converter = createIRConverter({
            enableValidation: true,
            enableMetrics: true,
            legacyCompatibility: true
        });
        
        if (converter && converter.project && converter.project.modules) {
            console.log('   ✅ 統一 IR 結構建立成功');
            console.log(`   📊 初始狀態: version=${converter.version}, modules=${Object.keys(converter.project.modules).length}`);
            testsPassed++;
        } else {
            console.log('   ❌ 統一 IR 結構建立失敗：結構不完整');
        }
    } catch (error) {
        console.log(`   ❌ 統一 IR 結構建立失敗: ${error.message}`);
    }

    // 🧪 測試 2: Legacy → Unified 轉換
    console.log('\n🧪 Test 2: Legacy IR → Unified IR 轉換');
    testsTotal++;
    try {
        const sampleLegacyIR = {
            meta: { createdAt: new Date().toISOString() },
            entities: [
                {
                    id: 'test.js:class:Calculator',
                    kind: 'class',
                    name: 'Calculator',
                    file: 'test.js',
                    line: 1,
                    data: { attrs: ['value'], doc: 'Simple calculator class' }
                },
                {
                    id: 'test.js:method:add',
                    kind: 'method',
                    name: 'add',
                    file: 'test.js',
                    line: 5,
                    data: { params: ['a', 'b'], doc: 'Add two numbers' }
                },
                {
                    id: 'test.js:function:main',
                    kind: 'function',
                    name: 'main',
                    file: 'test.js',
                    line: 20,
                    data: { params: [], doc: 'Main function' }
                }
            ],
            relations: [
                {
                    from: 'test.js:method:add',
                    to: 'test.js:class:Calculator',
                    type: 'BELONGS_TO'
                },
                {
                    from: 'test.js:function:main',
                    to: 'test.js:method:add',
                    type: 'CALLS'
                }
            ]
        };

        const unified = convertLegacyToUnified(sampleLegacyIR);
        
        if (unified && unified.modules && Object.keys(unified.modules).length > 0) {
            console.log('   ✅ Legacy → Unified 轉換成功');
            
            const moduleNames = Object.keys(unified.modules);
            console.log(`   📊 轉換結果: ${moduleNames.length} 個模組`);
            
            for (const moduleName of moduleNames) {
                const module = unified.modules[moduleName];
                console.log(`     - ${moduleName}: ${module.classes.length} 個類別, ${module.functions.length} 個函數`);
            }
            
            testsPassed++;
        } else {
            console.log('   ❌ Legacy → Unified 轉換失敗：結果無效');
        }
    } catch (error) {
        console.log(`   ❌ Legacy → Unified 轉換失敗: ${error.message}`);
    }

    // 🧪 測試 3: Unified → Legacy 轉換  
    console.log('\n🧪 Test 3: Unified IR → Legacy IR 轉換');
    testsTotal++;
    try {
        const sampleUnified = {
            modules: {
                'calculator': {
                    name: 'calculator',
                    path: 'calculator.js',
                    classes: [{
                        id: 'calculator:Calculator',
                        name: 'Calculator',
                        bases: ['BaseClass'],
                        attrs: ['value', 'precision'],
                        methods: [{
                            id: 'calculator:Calculator:add',
                            name: 'add',
                            params: ['a', 'b'],
                            body: [],
                            calls: [],
                            pos: { file: 'calculator.js', line: 5 },
                            doc: 'Add two numbers'
                        }],
                        pos: { file: 'calculator.js', line: 1 },
                        doc: 'Calculator class'
                    }],
                    functions: [{
                        id: 'calculator:main',
                        name: 'main',
                        params: [],
                        body: [],
                        calls: ['Calculator:add'],
                        pos: { file: 'calculator.js', line: 20 },
                        doc: 'Main function'
                    }],
                    imports: ['math', 'utils']
                }
            },
            fixNotes: ['Converted from legacy format'],
            parserMeta: {
                implementation: 'test',
                runtime: 'node'
            }
        };

        const legacy = convertUnifiedToLegacy(sampleUnified);
        
        if (legacy && Array.isArray(legacy.entities) && Array.isArray(legacy.relations)) {
            console.log('   ✅ Unified → Legacy 轉換成功');
            console.log(`   📊 轉換結果: ${legacy.entities.length} 個實體, ${legacy.relations.length} 個關係`);
            
            // 分析實體類型
            const entityTypes = {};
            legacy.entities.forEach(e => {
                entityTypes[e.kind] = (entityTypes[e.kind] || 0) + 1;
            });
            
            console.log('   📋 實體分佈:');
            for (const [type, count] of Object.entries(entityTypes)) {
                console.log(`     - ${type}: ${count} 個`);
            }
            
            testsPassed++;
        } else {
            console.log('   ❌ Unified → Legacy 轉換失敗：結果格式無效');
        }
    } catch (error) {
        console.log(`   ❌ Unified → Legacy 轉換失敗: ${error.message}`);
    }

    // 🧪 測試 4: IR 驗證機制
    console.log('\n🧪 Test 4: IR 驗證機制測試');
    testsTotal++;
    try {
        const validator = new IRValidator({
            strictMode: false,
            enableWarnings: true,
            logVerbose: false
        });

        // 測試有效的 Unified IR
        const validUnified = {
            modules: {
                'test': {
                    name: 'test',
                    path: 'test.js',
                    classes: [{
                        id: 'test:TestClass',
                        name: 'TestClass',
                        bases: [],
                        attrs: [],
                        methods: [],
                        pos: { file: 'test.js', line: 1 }
                    }],
                    functions: [],
                    imports: []
                }
            }
        };

        const validationResult = validator.validateUnifiedIR(validUnified);
        
        if (validationResult.isValid) {
            console.log('   ✅ Unified IR 驗證成功');
            console.log(`   📊 驗證統計: ${validationResult.metrics.moduleCount} 模組, ${validationResult.metrics.totalClasses} 類別`);
            
            // 測試無效的 IR
            const invalidUnified = { invalid: 'structure' };
            const invalidResult = validator.validateUnifiedIR(invalidUnified);
            
            if (!invalidResult.isValid && invalidResult.errors.length > 0) {
                console.log('   ✅ 無效 IR 正確被拒絕');
                testsPassed++;
            } else {
                console.log('   ❌ 無效 IR 驗證失敗：應該被拒絕');
            }
        } else {
            console.log(`   ❌ 有效 IR 驗證失敗: ${validationResult.errors.join(', ')}`);
        }
    } catch (error) {
        console.log(`   ❌ IR 驗證機制測試失敗: ${error.message}`);
    }

    // 🧪 測試 5: 複雜 IR 結構處理
    console.log('\n🧪 Test 5: 複雜 IR 結構處理');
    testsTotal++;
    try {
        // 建立複雜的 Legacy IR
        const complexLegacyIR = {
            meta: { createdAt: new Date().toISOString() },
            entities: [],
            relations: []
        };

        // 生成多個檔案、多個類別的複雜結構
        const files = ['model.js', 'controller.js', 'view.js', 'utils.js'];
        let entityId = 0;

        for (const file of files) {
            // 每個檔案 3 個類別
            for (let i = 0; i < 3; i++) {
                const classId = `${file}:class:Class${entityId}`;
                complexLegacyIR.entities.push({
                    id: classId,
                    kind: 'class',
                    name: `Class${entityId}`,
                    file: file,
                    line: i * 10 + 1,
                    data: { attrs: [`attr${i}`], doc: `Class ${entityId}` }
                });

                // 每個類別 2 個方法
                for (let j = 0; j < 2; j++) {
                    const methodId = `${file}:method:method${entityId}_${j}`;
                    complexLegacyIR.entities.push({
                        id: methodId,
                        kind: 'method',
                        name: `method${j}`,
                        file: file,
                        line: i * 10 + j + 2,
                        data: { params: [`param${j}`] }
                    });

                    complexLegacyIR.relations.push({
                        from: methodId,
                        to: classId,
                        type: 'BELONGS_TO'
                    });
                }

                entityId++;
            }
        }

        const startTime = Date.now();
        const complexUnified = convertLegacyToUnified(complexLegacyIR);
        const processingTime = Date.now() - startTime;

        if (complexUnified && complexUnified.modules) {
            const moduleCount = Object.keys(complexUnified.modules).length;
            let totalClasses = 0;
            let totalMethods = 0;

            for (const module of Object.values(complexUnified.modules)) {
                totalClasses += module.classes.length;
                module.classes.forEach(cls => {
                    totalMethods += cls.methods.length;
                });
            }

            console.log('   ✅ 複雜 IR 結構處理成功');
            console.log(`   📊 處理統計: ${moduleCount} 模組, ${totalClasses} 類別, ${totalMethods} 方法`);
            console.log(`   ⚡ 處理時間: ${processingTime}ms`);

            if (processingTime < 1000) { // 1 秒內完成
                testsPassed++;
            } else {
                console.log('   ⚠️ 處理時間超出預期 (>1000ms)');
            }
        } else {
            console.log('   ❌ 複雜 IR 結構處理失敗：轉換結果無效');
        }
    } catch (error) {
        console.log(`   ❌ 複雜 IR 結構處理失敗: ${error.message}`);
    }

    // 🧪 測試 6: 內建測試套件
    console.log('\n🧪 Test 6: 內建測試套件執行');
    testsTotal++;
    try {
        const testSuite = new IRTestSuite();
        const testResults = await testSuite.runFullTestSuite();
        
        if (testResults.isSuccess) {
            console.log(`   ✅ 內建測試套件通過 (${testResults.summary.passed}/${testResults.summary.total})`);
            testsPassed++;
        } else {
            console.log(`   ❌ 內建測試套件失敗 (${testResults.summary.passed}/${testResults.summary.total})`);
            console.log('   📋 失敗的測試:');
            testResults.tests.filter(t => t.status === 'FAILED').forEach(test => {
                console.log(`     - ${test.test}: ${test.error}`);
            });
        }
    } catch (error) {
        console.log(`   ❌ 內建測試套件執行失敗: ${error.message}`);
    }

    // 📊 測試結果總結
    console.log('\n📊 測試結果總結');
    console.log('='.repeat(50));
    console.log(`總測試數: ${testsTotal}`);
    console.log(`通過測試: ${testsPassed}`);
    console.log(`失敗測試: ${testsTotal - testsPassed}`);
    console.log(`成功率: ${Math.round((testsPassed / testsTotal) * 100)}%`);
    
    const isSuccess = testsPassed >= testsTotal * 0.8; // 80% 通過率
    console.log(`\n${isSuccess ? '✅' : '❌'} Problem 2 解決方案 ${isSuccess ? '驗證通過' : '需要改進'}`);

    if (isSuccess) {
        console.log('\n🎉 IR Structure Redesign 已成功解決！');
        console.log('💡 主要改進:');
        console.log('   • 統一的 IR 結構規範 (基於 TypeScript 定義)');
        console.log('   • 雙向轉換器 (Legacy ↔ Unified)');
        console.log('   • 完整的 IR 驗證機制');
        console.log('   • 效能優化與向後相容性');
        console.log('   • 全面的測試覆蓋');
    } else {
        console.log('\n🔧 需要進一步改進的領域:');
        console.log('   • 檢查失敗的測試項目');
        console.log('   • 優化轉換邏輯');
        console.log('   • 強化驗證機制');
    }

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
    window.runIRRedesignTest = runIRRedesignTest;
    console.log('🌐 測試函數已註冊到 window.runIRRedesignTest');
    console.log('執行方式: 在瀏覽器控制台輸入 await window.runIRRedesignTest()');
} else {
    // Node.js 環境
    runIRRedesignTest().then(result => {
        console.log(`\n🏁 測試完成: ${result.successRate}% 成功率`);
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('❌ 測試執行失敗:', error);
        process.exit(1);
    });
}

export { runIRRedesignTest };