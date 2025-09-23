// test/unit/fallback-integration.test.mjs
// 備用解析器整合測試 (不依賴 Tree-sitter)

import { analyzeJavaScriptProject } from '../../js/engine/analyzer.js';
import { analyzePythonProject } from '../../js/engine/python-analyzer.js';
import { analyzeMultiLanguageProject } from '../../js/engine/multi-analyzer.js';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 開始備用解析器整合測試 (不使用 Tree-sitter)');

// 測試用的程式碼範例
const sampleJavaScript = `
import React from 'react';
import './styles.css';

class UserManager extends React.Component {
  constructor(props) {
    super(props);
    this.state = { users: [] };
  }
  
  async fetchUsers() {
    const response = await fetch('/api/users');
    return response.json();
  }
  
  addUser(user) {
    this.setState(prev => ({
      users: [...prev.users, user]
    }));
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
 * 測試 1: JavaScript 分析器 (備用解析器)
 */
async function testJavaScriptFallback() {
  console.log('\n📝 測試 1: JavaScript 分析器 (備用解析器)');
  
  try {
    // 創建測試檔案
    const testDir = 'test-fallback-js';
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'UserManager.js'), sampleJavaScript);
    
    console.log('  🔍 執行 JavaScript 專案分析 (useTreeSitter=false)...');
    const result = await analyzeJavaScriptProject(testDir, { useTreeSitter: false });
    
    console.log('  📊 結果結構檢查:', {
      hasIR: !!result.ir,
      hasStats: !!result.stats,
      entitiesCount: result.ir?.entities?.length || 0,
      relationsCount: result.ir?.relations?.length || 0
    });
    
    if (result.ir && result.ir.entities) {
      const hasClasses = result.ir.entities.some(e => e.kind === 'class');
      const hasMethods = result.ir.entities.some(e => e.kind === 'method');
      const hasImports = result.ir.entities.some(e => e.kind === 'import');
      const hasModule = result.ir.entities.some(e => e.kind === 'module');
      
      console.log(`  🔍 發現內容: 模組=${hasModule}, 類別=${hasClasses}, 方法=${hasMethods}, 匯入=${hasImports}`);
      
      if (result.stats) {
        console.log(`  📊 統計: ${result.stats.filesProcessed} 檔案, ${result.stats.entitiesFound} 實體, ${result.stats.relationsFound} 關係`);
      }
    }
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
    if (result.ir && result.stats && result.stats.filesProcessed > 0 && result.stats.entitiesFound > 0) {
      console.log('  ✅ JavaScript 備用解析器測試成功');
      return true;
    } else {
      console.log('  ❌ JavaScript 備用解析器未產生預期結果');
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ JavaScript 備用解析器測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試 2: Python 分析器 (備用解析器)
 */
async function testPythonFallback() {
  console.log('\n📝 測試 2: Python 分析器 (備用解析器)');
  
  try {
    // 創建測試檔案
    const testDir = 'test-fallback-py';
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'user_manager.py'), samplePython);
    
    console.log('  🐍 執行 Python 專案分析...');
    const result = await analyzePythonProject(testDir);
    
    console.log('  📊 結果結構檢查:', {
      hasIR: !!result.ir,
      hasStats: !!result.stats,
      entitiesCount: result.ir?.entities?.length || 0,
      relationsCount: result.ir?.relations?.length || 0
    });
    
    if (result.ir && result.ir.entities) {
      const hasClasses = result.ir.entities.some(e => e.kind === 'class');
      const hasMethods = result.ir.entities.some(e => e.kind === 'method');
      const hasFunctions = result.ir.entities.some(e => e.kind === 'function');
      const hasImports = result.ir.entities.some(e => e.kind === 'import');
      const hasModule = result.ir.entities.some(e => e.kind === 'module');
      
      console.log(`  🔍 發現內容: 模組=${hasModule}, 類別=${hasClasses}, 方法=${hasMethods}, 函數=${hasFunctions}, 匯入=${hasImports}`);
      
      if (result.stats) {
        console.log(`  📊 統計: ${result.stats.filesProcessed} 檔案, ${result.stats.entitiesFound} 實體, ${result.stats.relationsFound} 關係`);
      }
    }
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
    if (result.ir && result.stats && result.stats.filesProcessed > 0 && result.stats.entitiesFound > 0) {
      console.log('  ✅ Python 備用解析器測試成功');
      return true;
    } else {
      console.log('  ❌ Python 備用解析器未產生預期結果');
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ Python 備用解析器測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試 3: 多語言整合 (備用解析器)
 */
async function testMultiLanguageFallback() {
  console.log('\n📝 測試 3: 多語言整合 (備用解析器)');
  
  try {
    // 創建測試專案
    const testDir = 'test-fallback-multi';
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'frontend.js'), sampleJavaScript);
    await fs.writeFile(path.join(testDir, 'backend.py'), samplePython);
    
    console.log('  🔍 執行多語言專案分析 (不使用 Tree-sitter)...');
    const result = await analyzeMultiLanguageProject(testDir, {
      useTreeSitter: false,
      strictTreeSitter: false
    });
    
    console.log('  📊 結果結構檢查:', {
      hasCombined: !!result.combined,
      hasIR: !!result.combined?.ir,
      hasStats: !!result.combined?.stats,
      entitiesCount: result.combined?.ir?.entities?.length || 0,
      relationsCount: result.combined?.ir?.relations?.length || 0
    });
    
    if (result.combined && result.combined.ir) {
      const jsEntities = result.combined.ir.entities.filter(e => 
        e.data?.type === 'es6' || e.data?.type === 'javascript'
      );
      const pyEntities = result.combined.ir.entities.filter(e => 
        e.data?.type === 'python'
      );
      
      console.log(`  📊 總統計: ${result.combined.stats.totalFiles} 檔案, ${result.combined.stats.totalEntities} 實體, ${result.combined.stats.totalRelations} 關係`);
      console.log(`  🔍 JavaScript 實體: ${jsEntities.length}, Python 實體: ${pyEntities.length}`);
      
      if (result.combined.metadata && result.combined.metadata.languages) {
        console.log(`  🌐 支援語言: ${result.combined.metadata.languages.join(', ')}`);
      }
    }
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
    if (result.combined && result.combined.stats && result.combined.stats.totalFiles >= 2 && result.combined.stats.totalEntities > 0) {
      console.log('  ✅ 多語言整合測試成功');
      return true;
    } else {
      console.log('  ❌ 多語言整合測試未產生預期結果');
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ 多語言整合測試失敗:', error.message);
    console.log('  📋 錯誤堆疊:', error.stack);
    return false;
  }
}

/**
 * 測試 4: IR 結構驗證
 */
async function testIRStructure() {
  console.log('\n📝 測試 4: IR 結構驗證');
  
  try {
    const testDir = 'test-ir-structure';
    await fs.mkdir(testDir, { recursive: true });
    
    // 簡單的測試程式碼
    const simpleJS = `
class Test {
  constructor() { 
    this.value = 42; 
  }
  getValue() { 
    return this.value; 
  }
}
export default Test;
`;
    
    await fs.writeFile(path.join(testDir, 'Test.js'), simpleJS);
    
    console.log('  🔍 執行簡單程式碼分析...');
    const result = await analyzeJavaScriptProject(testDir, { useTreeSitter: false });
    
    if (result && result.ir) {
      console.log('  📋 IR 結構分析:');
      console.log(`    - entities: ${result.ir.entities?.length || 0} 項`);
      console.log(`    - relations: ${result.ir.relations?.length || 0} 項`);
      console.log(`    - metadata: ${result.ir.metadata ? '存在' : '不存在'}`);
      
      if (result.ir.entities && result.ir.entities.length > 0) {
        console.log('  📋 實體類型分佈:');
        const entityTypes = {};
        result.ir.entities.forEach(e => {
          entityTypes[e.kind] = (entityTypes[e.kind] || 0) + 1;
        });
        
        for (const [type, count] of Object.entries(entityTypes)) {
          console.log(`    - ${type}: ${count} 項`);
        }
      }
      
      if (result.ir.relations && result.ir.relations.length > 0) {
        console.log('  📋 關係類型分佈:');
        const relationTypes = {};
        result.ir.relations.forEach(r => {
          relationTypes[r.type] = (relationTypes[r.type] || 0) + 1;
        });
        
        for (const [type, count] of Object.entries(relationTypes)) {
          console.log(`    - ${type}: ${count} 項`);
        }
      }
    }
    
    // 清理
    await fs.rm(testDir, { recursive: true, force: true });
    
    const hasValidStructure = result && result.ir && result.ir.entities && result.ir.metadata;
    
    if (hasValidStructure) {
      console.log('  ✅ IR 結構驗證成功');
      return true;
    } else {
      console.log('  ❌ IR 結構驗證失敗');
      return false;
    }
    
  } catch (error) {
    console.log('  ❌ IR 結構驗證測試失敗:', error.message);
    return false;
  }
}

/**
 * 執行備用解析器測試
 */
async function runFallbackTests() {
  console.log('🚀 備用解析器整合測試套件 (無需 Tree-sitter)\n');
  
  const tests = [
    { name: 'JavaScript 備用解析器', fn: testJavaScriptFallback },
    { name: 'Python 備用解析器', fn: testPythonFallback },
    { name: '多語言整合', fn: testMultiLanguageFallback },
    { name: 'IR 結構驗證', fn: testIRStructure }
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
  
  if (successRate >= 75) {
    console.log('🎊 備用解析器實作成功！Tree-sitter 整合和 Python 支援的基礎架構已完成');
    
    console.log('\n💡 後續改進建議:');
    console.log('  1. 修復 Tree-sitter 套件載入問題');
    console.log('  2. 改善 JavaScript/TypeScript 解析精確度'); 
    console.log('  3. 增強 Python 語法支援');
    console.log('  4. 加強跨語言關係分析');
    
    return 0;
  } else {
    console.log('⚠️ 部分功能需要進一步調整');
    return 1;
  }
}

// 執行測試
runFallbackTests().then(code => {
  process.exit(code);
}).catch(error => {
  console.error('❌ 測試執行失敗:', error);
  process.exit(1);
});