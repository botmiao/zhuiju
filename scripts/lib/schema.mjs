import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const schemaDirectory = path.resolve(fileURLToPath(new URL('../../schemas', import.meta.url)));
const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map();

export function loadSchema(name) {
  if (!validators.has(name)) {
    const filename = path.join(schemaDirectory, `${name}.schema.json`);
    const schema = JSON.parse(fs.readFileSync(filename, 'utf8'));
    validators.set(name, ajv.compile(schema));
  }
  return validators.get(name);
}

export function assertSchema(name, value) {
  const validate = loadSchema(name);
  if (!validate(value)) {
    const details = (validate.errors || []).map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ');
    throw new Error(`Schema validation failed for ${name}: ${details}`);
  }
  return value;
}
