import { batchUpdateTokenInfo, getTokenInfoByPage, getTokensWithEmptySolScanImage } from "@/service/TokenInfoService";
import type { TokenInfo } from "@/type/token";
import { SolScanAPi } from "@/utils/solscanUtl";

const tokenMetadataUpdate = async () => {
    let pageNum = 1;
    let pageSize = 20;

    while (true) {
        const data = await getTokenInfoByPage(pageNum, pageSize);
        if (data.data.length === 0) {
            break;
        }

        const solscanApi = new SolScanAPi();
        const tokenList = await solscanApi.getMultiTokenInfo(data.data.map(item => item.token_address));

        const tokenInfoList: TokenInfo[] = tokenList.map(item => solscanApi.solscanTokenInfoToTokenInfo(item));

        await batchUpdateTokenInfo(tokenInfoList);

        console.log(`page ${pageNum} updated, total ${data.total} tokens ,updated ${tokenInfoList.length} tokens    `);
        pageNum++;
    }
};

/**
 * 专门用于补全 sol_scan_image 为空的 token 数据
 * 这个方法会查找所有 sol_scan_image 为空的 token，并通过 SolScan API 获取最新的图片信息进行补全
 */
export const updateEmptySolScanImageTokens = async (): Promise<{
    processedCount: number;
    successCount: number;
    failedCount: number;
    totalEmptyTokens: number;
}> => {
    let pageNum = 1;
    const pageSize = 20; // 每页处理20个token，避免API请求过多
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let totalEmptyTokens = 0;

    console.log("🔍 开始检查并补全 sol_scan_image 为空的 token 数据...");

    try {
        while (true) {
            // 获取 sol_scan_image 为空的 token 数据
            const data = await getTokensWithEmptySolScanImage(pageNum, pageSize);
            
            if (data.data.length === 0) {
                break;
            }

            // 第一次循环时记录总数
            if (pageNum === 1) {
                totalEmptyTokens = data.total;
                console.log(`📊 发现 ${totalEmptyTokens} 个 sol_scan_image 为空的 token 需要补全`);
            }

            const solscanApi = new SolScanAPi();
            
            try {
                // 获取这批 token 的 SolScan 信息
                const tokenAddresses = data.data.map(item => item.token_address);
                console.log(`📡 正在获取第 ${pageNum} 页 ${tokenAddresses.length} 个 token 的 SolScan 信息...`);
                
                const tokenList = await solscanApi.getMultiTokenInfo(tokenAddresses);
                
                // 转换为 TokenInfo 格式，只更新有效的数据
                const validTokenInfoList: TokenInfo[] = [];
                
                for (let i = 0; i < tokenList.length; i++) {
                    const solscanToken = tokenList[i];
                    if (solscanToken && solscanToken.icon && solscanToken.icon.trim() !== '') {
                        const tokenInfo = solscanApi.solscanTokenInfoToTokenInfo(solscanToken);
                        validTokenInfoList.push(tokenInfo);
                    }
                }

                console.log(`✅ 获取到 ${validTokenInfoList.length} 个有效的 token 图片信息`);

                if (validTokenInfoList.length > 0) {
                    // 批量更新数据库
                    const updateResult = await batchUpdateTokenInfo(validTokenInfoList);
                    successCount += updateResult.successCount;
                    failedCount += updateResult.failedTokens.length;

                    if (updateResult.failedTokens.length > 0) {
                        console.log(`⚠️  更新失败的 token: ${updateResult.failedTokens.join(', ')}`);
                    }
                }

                processedCount += data.data.length;
                console.log(`📈 第 ${pageNum} 页处理完成，已处理: ${processedCount}/${totalEmptyTokens}, 成功: ${successCount}, 失败: ${failedCount}`);

            } catch (apiError) {
                console.error(`❌ 第 ${pageNum} 页 SolScan API 调用失败:`, apiError);
                failedCount += data.data.length;
                processedCount += data.data.length;
            }

            pageNum++;

            // 添加延迟避免API请求过于频繁
            if (pageNum <= data.totalPages) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟1秒
            }
        }

        const result = {
            processedCount,
            successCount,
            failedCount,
            totalEmptyTokens
        };

        console.log("🎉 sol_scan_image 补全任务完成!");
        console.log(`📊 总计: 处理 ${processedCount} 个，成功 ${successCount} 个，失败 ${failedCount} 个`);

        return result;

    } catch (error) {
        console.error("❌ updateEmptySolScanImageTokens 执行失败:", error);
        throw error;
    }
};

export { tokenMetadataUpdate };