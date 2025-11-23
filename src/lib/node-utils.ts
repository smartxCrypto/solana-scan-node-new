import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

export async function readTextFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
}

export async function writeTextFile(filePath: string, data: string): Promise<void> {
    await fs.writeFile(filePath, data, 'utf-8');
}

export function readTextFileSync(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
}

export function writeTextFileSync(filePath: string, data: string): void {
    fs.writeFileSync(filePath, data, 'utf-8');
}

export async function mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.ensureDir(path);
}

export async function stat(path: string): Promise<fs.Stats> {
    return await fs.stat(path);
}

export async function remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
        await fs.remove(path);
    } else {
        await fs.unlink(path);
    }
}

export async function* readDir(path: string): AsyncGenerator<{ name: string; isFile: boolean; isDirectory: boolean }> {
    const entries = await fs.readdir(path, { withFileTypes: true });
    for (const entry of entries) {
        yield {
            name: entry.name,
            isFile: entry.isFile(),
            isDirectory: entry.isDirectory()
        };
    }
}

export function exit(code?: number): never {
    process.exit(code);
}

export const args = process.argv.slice(2);

export const env = {
    get: (key: string): string | undefined => process.env[key],
    set: (key: string, value: string): void => {
        process.env[key] = value;
    },
    has: (key: string): boolean => key in process.env,
    delete: (key: string): void => {
        delete process.env[key];
    }
};

export function addSignalListener(signal: NodeJS.Signals, handler: () => void): void {
    process.on(signal, handler);
}

/**
 * 安全地将 bigint/string/number 转换为 number
 * @param value - 要转换的值
 * @param defaultValue - 转换失败时的默认值，默认为 0
 * @returns 转换后的 number 值
 */
export function toSafeNumber(value: bigint | string | number | undefined | null, defaultValue: number = 0): number {
    if (value == null) return defaultValue;
    
    // 处理 bigint
    if (typeof value === 'bigint') {
        // 检查是否超出安全整数范围
        if (value > Number.MAX_SAFE_INTEGER) {
            console.warn(`Value exceeds MAX_SAFE_INTEGER: ${value}, returning MAX_SAFE_INTEGER`);
            return Number.MAX_SAFE_INTEGER;
        }
        if (value < Number.MIN_SAFE_INTEGER) {
            console.warn(`Value below MIN_SAFE_INTEGER: ${value}, returning MIN_SAFE_INTEGER`);
            return Number.MIN_SAFE_INTEGER;
        }
        return Number(value);
    }
    
    // 处理 string
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (isNaN(parsed)) {
            console.warn(`Cannot convert string to number: "${value}", returning default value`);
            return defaultValue;
        }
        if (parsed > Number.MAX_SAFE_INTEGER) {
            console.warn(`Parsed value exceeds MAX_SAFE_INTEGER: ${value}, returning MAX_SAFE_INTEGER`);
            return Number.MAX_SAFE_INTEGER;
        }
        if (parsed < Number.MIN_SAFE_INTEGER) {
            console.warn(`Parsed value below MIN_SAFE_INTEGER: ${value}, returning MIN_SAFE_INTEGER`);
            return Number.MIN_SAFE_INTEGER;
        }
        return parsed;
    }
    
    // 已经是 number
    if (typeof value === 'number') {
        if (isNaN(value)) return defaultValue;
        return value;
    }
    
    return defaultValue;
} 