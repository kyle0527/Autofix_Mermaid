// test/unit/tree-sitter-integration.test.mjs
// Tree-sitter 整合與 Python 支援測試

import { TreeSitterLoader } from '../../js/engine/tree-sitter-loader.js';
import { analyzeJavaScriptProject } from '../../js/engine/analyzer.js';
import { analyzePythonProject } from '../../js/engine/python-analyzer.js';
import { analyzeMultiLanguageProject, quickAnalyze } from '../../js/engine/multi-analyzer.js';
import { processCodeToMermaid } from '../../js/engine/processor.js';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 開始 Tree-sitter 整合與 Python 支援測試');

// 測試用的程式碼範例
const sampleJavaScript = `
import React from 'react';

class UserManager extends React.Component {
  constructor(props) {
    super(props);
    this.state = { users: [] };
  }
  
  async fetchUsers() {
    const response = await fetch('/api/users');
    return response.json();
  }
  
  render() {
    return <div>Users: {this.state.users.length}</div>;
  }
}

export default UserManager;
`;

const samplePython = `
from typing import List, Dict
import asyncio
import json

class UserManager:
    def __init__(self):
        self.users: List[Dict] = []
        self.db_connection = None
    
    async def fetch_users(self) -> List[Dict]:
        """Fetch users from database"""
        query = "SELECT * FROM users"
        result = await self.db_connection.execute(query)
        return result.fetchall()
    
    def add_user(self, user_data: Dict) -> bool:
        """Add a new user"""
        if self.validate_user(user_data):
            self.users.append(user_data)
            return True
        return False
    
    @staticmethod
    def validate_user(user_data: Dict) -> bool:
        required_fields = ['name', 'email']
        return all(field in user_data for field in required_fields)

def main():
    manager = UserManager()
    user = {"name": "John", "email": "john@example.com"}
    manager.add_user(user)

if __name__ == "__main__":
    main()
`;

/**
 * 測試 1: Tree-sitter 載入器基礎功能
 */
async function testTreeSitterLoader() {
  console.log('\n📝 測試 1: Tree-sitter 載入器');
  
  try {
    const loader = new TreeSitterLoader();
    
    // 測試 JavaScript 語言載入
    console.log('  🔍 載入 JavaScript 語言...');
    await loader.loadLanguage('javascript', 'js/wasm/tree-sitter.wasm');
    
    // 測試解析功能
    console.log('  🔍 測試 JavaScript 解析...');
    const jsResult = await loader.parse('javascript', 'function test() { return 42; }');
    
    if (jsResult.success && jsResult.tree) {
      console.log('  ✅ JavaScript Tree-sitter 載入和解析成功');
      return true;
    } else {
      console.log('  ❌ JavaScript 解析失敗:', jsResult.error);
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ Tree-sitter 載入器測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試 2: JavaScript 分析器 (Tree-sitter 整合)
 */
async function testJavaScriptAnalyzer() {
  console.log('\n📝 測試 2: JavaScript 分析器 (Tree-sitter 整合)');
  
  try {
    // 創建測試檔案
    const testDir = 'test-temp-js';
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'UserManager.js'), sampleJavaScript);
    
    console.log('  🔍 執行 JavaScript 專案分析...');
    const result = await analyzeJavaScriptProject(testDir, { useTreeSitter: true });
    
    // 驗證結果
    const hasClasses = result.ir.entities.some(e => e.kind === 'class');
    const hasMethods = result.ir.entities.some(e => e.kind === 'method');
    const hasImports = result.ir.entities.some(e => e.kind === 'import');
    
    console.log(`  📊 統計: ${result.stats.filesProcessed} 檔案, ${result.stats.entitiesFound} 實體, ${result.stats.relationsFound} 關係`);
    console.log(`  🔍 發現: 類別=${hasClasses}, 方法=${hasMethods}, 匯入=${hasImports}`);
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
    if (result.stats.filesProcessed > 0 && result.stats.entitiesFound > 0) {
      console.log('  ✅ JavaScript 分析器測試成功');
      return true;
    } else {
      console.log('  ❌ JavaScript 分析器未產生預期結果');
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ JavaScript 分析器測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試 3: Python 分析器
 */
async function testPythonAnalyzer() {
  console.log('\n📝 測試 3: Python 分析器');
  
  try {
    // 創建測試檔案
    const testDir = 'test-temp-py';
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'user_manager.py'), samplePython);
    
    console.log('  🐍 執行 Python 專案分析...');
    const result = await analyzePythonProject(testDir);
    
    // 驗證結果
    const hasClasses = result.ir.entities.some(e => e.kind === 'class');
    const hasMethods = result.ir.entities.some(e => e.kind === 'method');
    const hasFunctions = result.ir.entities.some(e => e.kind === 'function');
    const hasImports = result.ir.entities.some(e => e.kind === 'import');
    
    console.log(`  📊 統計: ${result.stats.filesProcessed} 檔案, ${result.stats.entitiesFound} 實體, ${result.stats.relationsFound} 關係`);
    console.log(`  🔍 發現: 類別=${hasClasses}, 方法=${hasMethods}, 函數=${hasFunctions}, 匯入=${hasImports}`);
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
    if (result.stats.filesProcessed > 0 && result.stats.entitiesFound > 0) {
      console.log('  ✅ Python 分析器測試成功');
      return true;
    } else {
      console.log('  ❌ Python 分析器未產生預期結果');
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ Python 分析器測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試 4: 多語言整合分析
 */
async function testMultiLanguageAnalyzer() {
  console.log('\n📝 測試 4: 多語言整合分析');
  
  try {
    // 創建測試專案
    const testDir = 'test-temp-multi';
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'frontend.js'), sampleJavaScript);
    await fs.writeFile(path.join(testDir, 'backend.py'), samplePython);
    
    console.log('  🔍 執行多語言專案分析...');
    const result = await analyzeMultiLanguageProject(testDir);
    
    // 驗證結果
    const jsEntities = result.combined.ir.entities.filter(e => e.data?.type === 'es6' || e.data?.type === 'javascript');
    const pyEntities = result.combined.ir.entities.filter(e => e.data?.type === 'python');
    
    console.log(`  📊 總統計: ${result.combined.stats.totalFiles} 檔案, ${result.combined.stats.totalEntities} 實體, ${result.combined.stats.totalRelations} 關係`);
    console.log(`  🔍 JavaScript 實體: ${jsEntities.length}, Python 實體: ${pyEntities.length}`);
    console.log(`  🌐 支援語言: ${result.combined.metadata.languages.join(', ')}`);
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
    if (result.combined.stats.totalFiles >= 2 && jsEntities.length > 0 && pyEntities.length > 0) {
      console.log('  ✅ 多語言整合分析測試成功');
      return true;
    } else {
      console.log('  ❌ 多語言整合分析未產生預期結果');
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ 多語言整合分析測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試 5: 快速分析 (自動檢測)
 */
async function testQuickAnalyze() {
  console.log('\n📝 測試 5: 快速分析 (自動檢測)');
  
  try {
    // 創建測試專案
    const testDir = 'test-temp-quick';
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'app.js'), 'function hello() { console.log("Hello"); }');
    await fs.writeFile(path.join(testDir, 'utils.py'), 'def greet(name): return f"Hello {name}"');
    
    console.log('  ⚡ 執行快速分析...');
    const result = await quickAnalyze(testDir);
    
    console.log(`  📊 快速分析結果: ${result.combined.stats.totalFiles} 檔案, ${result.combined.stats.totalEntities} 實體`);
    console.log(`  🌐 自動檢測語言: ${result.combined.metadata.languages.join(', ')}`);
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
    if (result.combined.metadata.languages.length >= 2) {
      console.log('  ✅ 快速分析測試成功');
      return true;
    } else {
      console.log('  ❌ 快速分析未檢測到預期語言');
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ 快速分析測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試 6: 端到端流程 (分析 → 生成 → 修復)
 */
async function testEndToEndPipeline() {
  console.log('\n📝 測試 6: 端到端流程測試');
  
  try {
    // 創建測試檔案
    const testDir = 'test-temp-e2e';
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'component.js'), sampleJavaScript);
    
    console.log('  🔄 執行端到端處理流程...');
    const result = await processCodeToMermaid(testDir, {
      outputFormat: 'class',
      includeDetails: true
    });
    
    console.log(`  📊 處理結果: 成功=${result.success}, Mermaid長度=${result.mermaid?.length || 0}`);
    
    if (result.mermaid) {
      console.log('  🎯 生成的 Mermaid 圖表類型:', result.mermaid.split('\n')[0]);
    }
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
    if (result.success && result.mermaid && result.mermaid.length > 50) {
      console.log('  ✅ 端到端流程測試成功');
      return true;
    } else {
      console.log('  ❌ 端到端流程測試失敗');
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ 端到端流程測試失敗:', error.message);
    return false;
  }
}

/**
 * 執行所有測試
 */
async function runAllTests() {
  console.log('🚀 Tree-sitter 整合與 Python 支援完整測試套件\n');
  
  const tests = [
    { name: 'Tree-sitter 載入器', fn: testTreeSitterLoader },
    { name: 'JavaScript 分析器', fn: testJavaScriptAnalyzer }, 
    { name: 'Python 分析器', fn: testPythonAnalyzer },
    { name: '多語言整合', fn: testMultiLanguageAnalyzer },
    { name: '快速分析', fn: testQuickAnalyze },
    { name: '端到端流程', fn: testEndToEndPipeline }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
    } catch (error) {
      console.log(`  ❌ ${test.name} 測試異常終止:`, error.message);
      results.push({ name: test.name, success: false });
    }
  }
  
  // 測試總結
  console.log('\n📋 測試總結:');
  const passedTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);
  
  console.log(`✅ 通過: ${passedTests.length}/${results.length} 項測試`);
  
  if (passedTests.length > 0) {
    console.log('🎉 通過的測試:');
    passedTests.forEach(test => console.log(`  ✅ ${test.name}`));
  }
  
  if (failedTests.length > 0) {
    console.log('❌ 失敗的測試:');
    failedTests.forEach(test => console.log(`  ❌ ${test.name}`));
  }
  
  const successRate = (passedTests.length / results.length) * 100;
  console.log(`\n🎯 成功率: ${successRate.toFixed(1)}%`);
  
  if (successRate >= 80) {
    console.log('🎊 Tree-sitter 整合與 Python 支援實作成功！');
    return 0;
  } else {
    console.log('⚠️ 部分功能需要進一步調整');
    return 1;
  }
}

// 執行測試
runAllTests().then(code => {
  process.exit(code);
}).catch(error => {
  console.error('❌ 測試執行失敗:', error);
  process.exit(1);
});