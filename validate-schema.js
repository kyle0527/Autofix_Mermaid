// validate-schema.js
// 用於驗證 rulepack.json 與 promptpack.json 是否符合 schema

import Ajv2020 from "ajv/dist/2020.js";
import fs from "fs";

const ajv = new Ajv2020({ allErrors: true, strict: true });

function validateFile(schemaPath, dataPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    console.error(`❌ 驗證失敗: ${dataPath}`);
    console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
    process.exit(1);
  } else {
    console.log(`✅ 驗證通過: ${dataPath}`);
  }
}

// 驗證 rulepack
validateFile("./rulepack.schema.json", "./rules/rulepack.json");
// 驗證 promptpack
validateFile("./promptpack.schema.json", "./rules/promptpack.json");
