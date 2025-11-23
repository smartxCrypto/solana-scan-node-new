// src/service/MathService
import Decimal from "decimal.js";


export class MathUtil {
    // 加法
    static add(a: number | string, b: number | string): string {
        return new Decimal(a).plus(b).toString();
    }

    // 减法
    static subtract(a: number | string, b: number | string): string {
        return new Decimal(a).minus(b).toString();
    }

    // 乘法
    static multiply(a: number | string, b: number | string): string {
        return new Decimal(a).times(b).toString();
    }

    // 除法（自动处理除数为零）
    static divide(a: number | string, b: number | string): string {
        const divisor = new Decimal(b);
        if (divisor.isZero()) return "0";
        return new Decimal(a).dividedBy(divisor).toString();
    }

    // 幂运算：10 的 x 次方
    static powerOfTen(x: number | string): string {
        return new Decimal(10).pow(x).toString();
    }

    // 保留小数位
    static toFixed(val: number | string, digits = 8): string {
        return new Decimal(val).toDecimalPlaces(digits, Decimal.ROUND_DOWN).toFixed(digits);
    }
}