
import {TokenPriceService} from "@/service/TokenPriceService";
// 实现一个定时任务，每秒执行一次
setInterval(async () => {
    try {
        const price = await TokenPriceService.getPrice('SOL', 'USDT');
        console.log(`Current SOL/USDT price: ${price}`);
    } catch (error) {
        console.error('Error fetching SOL/USDT price:', error);
    }
}, 1000);