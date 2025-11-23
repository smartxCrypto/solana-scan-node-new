# Solana Collection Node

A Node.js project with TypeScript, Jest testing framework, and path aliases configured.

## Features

- **TypeScript** for type-safe development
- **Jest** for testing with TypeScript support
- **Path Aliases** using `@/` to reference the `src` directory
- **Development server** with hot reload
- **Module aliases** for both development and production

## Getting Started

### Installation

```bash
yarn install
```

### Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build the TypeScript project to `dist/` directory
- `yarn test` - Run tests with Jest
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Run tests with coverage report

### Path Aliases

You can use the `@/` prefix to import from the `src` directory:

```typescript
// Instead of relative imports
import { greet } from '../../../utils/greeting';

// Use path aliases
import { greet } from '@/utils/greeting';
```

## Project Structure

```
solana_collection_node/
├── src/
│   ├── utils/
│   │   ├── greeting.ts
│   │   └── greeting.test.ts
│   └── index.ts
├── dist/              # Built files (generated)
├── coverage/          # Test coverage reports (generated)
├── tsconfig.json      # TypeScript configuration
├── jest.config.js     # Jest configuration
└── package.json
```

## Configuration Details

### TypeScript Configuration (`tsconfig.json`)

- Configured with path aliases (`@/*` → `src/*`)
- Targets ES2020 with CommonJS modules
- Includes source maps and declaration files

### Jest Configuration (`jest.config.js`)

- Uses `ts-jest` preset for TypeScript support
- Configured with `moduleNameMapper` for path aliases
- Includes coverage collection and reporting

### Path Alias Resolution

The project uses multiple configurations to handle path aliases:

1. **TypeScript Compiler**: `tsconfig.json` with `paths` mapping
2. **Jest**: `moduleNameMapper` in `jest.config.js`
3. **Node.js Runtime**: `module-alias` package with `_moduleAliases` in `package.json`
4. **Development**: `tsconfig-paths` for `ts-node-dev`

## Testing

Tests are located alongside source files with `.test.ts` or `.spec.ts` extensions. Jest is configured to:

- Run TypeScript files directly
- Resolve path aliases
- Collect coverage from `src/` directory
- Generate HTML coverage reports

Example test:

```typescript
import { greet } from '@/utils/greeting';

describe('greet function', () => {
  test('should return greeting message', () => {
    const result = greet('Jest');
    expect(result).toBe('Hello, Jest!');
  });
});
``` 
- 区块数据解析入库
pm2 start task/BlockDataHandleTask.js
- 同步SOL价格
pm2 start task/SyncSolPrice.js
- 接收区块数据
pm2 start scan/SolanaBlockScanner.js
- 保存更新LP数据
pm2 start task/SaveLPInfoTask.js