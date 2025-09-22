import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');

describe('Schema Validation', () => {
  let ajv;
  let rulepackSchema;
  let promptpackSchema;

  // 設置
  it('should initialize AJV with draft-2020-12 support', () => {
    ajv = new Ajv2020({ allErrors: true, strict: true });
    assert.ok(ajv, 'AJV instance should be created');
  });

  it('should load rulepack schema', () => {
    const schemaPath = path.join(rootDir, 'rulepack.schema.json');
    rulepackSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    assert.ok(rulepackSchema, 'Rulepack schema should be loaded');
    assert.equal(rulepackSchema.title, 'RulePack');
  });

  it('should load promptpack schema', () => {
    const schemaPath = path.join(rootDir, 'promptpack.schema.json');
    promptpackSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    assert.ok(promptpackSchema, 'Promptpack schema should be loaded');
    assert.equal(promptpackSchema.title, 'PromptPack');
  });

  // 正向測試：有效文件應通過驗證
  it('should validate valid rulepack.json', () => {
    const dataPath = path.join(rootDir, 'rules/rulepack.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const validate = ajv.compile(rulepackSchema);
    const valid = validate(data);
    
    if (!valid) {
      console.log('Validation errors:', validate.errors);
    }
    assert.ok(valid, 'Valid rulepack should pass validation');
  });

  it('should validate valid promptpack.json', () => {
    const dataPath = path.join(rootDir, 'rules/promptpack.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const validate = ajv.compile(promptpackSchema);
    const valid = validate(data);
    
    if (!valid) {
      console.log('Validation errors:', validate.errors);
    }
    assert.ok(valid, 'Valid promptpack should pass validation');
  });

  // 負向測試：無效文件應被攔截
  it('should reject rulepack missing required enabled field', () => {
    const dataPath = path.join(rootDir, 'rules/rulepack.bad1.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const validate = ajv.compile(rulepackSchema);
    const valid = validate(data);
    
    assert.ok(!valid, 'Invalid rulepack should fail validation');
    assert.ok(validate.errors.some(e => e.message.includes('enabled')), 
      'Should report missing enabled field');
  });

  it('should reject rulepack with invalid data types', () => {
    const dataPath = path.join(rootDir, 'rules/rulepack.bad2.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const validate = ajv.compile(rulepackSchema);
    const valid = validate(data);
    
    assert.ok(!valid, 'Invalid rulepack should fail validation');
    assert.ok(validate.errors.some(e => e.message.includes('boolean')), 
      'Should report enabled field type error');
    assert.ok(validate.errors.some(e => e.message.includes('allowed values')), 
      'Should report invalid enum values');
  });

  it('should reject promptpack missing required fields', () => {
    const dataPath = path.join(rootDir, 'rules/promptpack.bad1.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const validate = ajv.compile(promptpackSchema);
    const valid = validate(data);
    
    assert.ok(!valid, 'Invalid promptpack should fail validation');
    assert.ok(validate.errors.some(e => e.message.includes('version')), 
      'Should report missing version field');
    assert.ok(validate.errors.some(e => e.message.includes('input_type')), 
      'Should report missing input_type field');
  });

  // 錯誤訊息可讀性測試
  it('should provide readable error messages', () => {
    const dataPath = path.join(rootDir, 'rules/rulepack.bad1.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const validate = ajv.compile(rulepackSchema);
    const valid = validate(data);
    
    assert.ok(!valid, 'Should fail validation');
    
    const errorText = ajv.errorsText(validate.errors, { separator: '\n' });
    assert.ok(errorText.length > 0, 'Should have error text');
    assert.ok(errorText.includes('enabled'), 'Error message should mention missing field');
    
    // 檢查錯誤結構的完整性
    assert.ok(validate.errors[0].instancePath !== undefined, 'Should have instancePath');
    assert.ok(validate.errors[0].message !== undefined, 'Should have message');
    assert.ok(validate.errors[0].params !== undefined, 'Should have params');
  });
});