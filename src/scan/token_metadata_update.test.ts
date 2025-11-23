import { updateEmptySolScanImageTokens } from './token_metadata_update';
import { getTokensWithEmptySolScanImage } from '../service/TokenInfoService';
import { SolScanAPi } from '../utils/solscanUtl';

// Mock dependencies
jest.mock('../service/TokenInfoService');
jest.mock('../utils/solscanUtl');

const mockGetTokensWithEmptySolScanImage = getTokensWithEmptySolScanImage as jest.MockedFunction<typeof getTokensWithEmptySolScanImage>;
const mockSolScanAPi = SolScanAPi as jest.MockedClass<typeof SolScanAPi>;

describe('Token Metadata Update', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('updateEmptySolScanImageTokens', () => {
        it('should handle empty result gracefully', async () => {
            // Mock empty result
            mockGetTokensWithEmptySolScanImage.mockResolvedValue({
                data: [],
                total: 0,
                pageNum: 1,
                pageSize: 20,
                totalPages: 0
            });

            const result = await updateEmptySolScanImageTokens();

            expect(result).toEqual({
                processedCount: 0,
                successCount: 0,
                failedCount: 0,
                totalEmptyTokens: 0
            });

            expect(mockGetTokensWithEmptySolScanImage).toHaveBeenCalledWith(1, 20);
        });

        it('should process tokens correctly when data exists', async () => {
            // Mock first call returns data, second call returns empty (end of pagination)
            mockGetTokensWithEmptySolScanImage
                .mockResolvedValueOnce({
                    data: [{ token_address: 'test-token', name: 'Test Token' } as any],
                    total: 1,
                    pageNum: 1,
                    pageSize: 20,
                    totalPages: 1
                })
                .mockResolvedValueOnce({
                    data: [],
                    total: 1,
                    pageNum: 2,
                    pageSize: 20,
                    totalPages: 1
                });

            // Mock SolScan API instance
            const mockSolscanInstance = {
                getMultiTokenInfo: jest.fn().mockResolvedValue([]),
                solscanTokenInfoToTokenInfo: jest.fn()
            };

            mockSolScanAPi.mockImplementation(() => mockSolscanInstance as any);

            const result = await updateEmptySolScanImageTokens();

            expect(result.processedCount).toBe(1);
            expect(result.totalEmptyTokens).toBe(1);
            expect(mockSolscanInstance.getMultiTokenInfo).toHaveBeenCalledWith(['test-token']);
        });

        it('should process tokens with valid sol_scan_image data', async () => {
            const mockTokenData = [
                {
                    token_address: 'token1',
                    name: 'Test Token 1',
                    symbol: 'TT1',
                    decimals: 6,
                    total_supply: 1000000,
                    sol_scan_image: null
                },
                {
                    token_address: 'token2', 
                    name: 'Test Token 2',
                    symbol: 'TT2',
                    decimals: 9,
                    total_supply: 2000000,
                    sol_scan_image: ''
                }
            ];

            // Mock first call returns data, second call returns empty (end of pagination)
            mockGetTokensWithEmptySolScanImage
                .mockResolvedValueOnce({
                    data: mockTokenData,
                    total: 2,
                    pageNum: 1,
                    pageSize: 20,
                    totalPages: 1
                })
                .mockResolvedValueOnce({
                    data: [],
                    total: 2,
                    pageNum: 2,
                    pageSize: 20,
                    totalPages: 1
                });

            // Mock SolScan API
            const mockSolscanInstance = {
                getMultiTokenInfo: jest.fn().mockResolvedValue([
                    {
                        address: 'token1',
                        name: 'Test Token 1',
                        symbol: 'TT1',
                        icon: 'https://example.com/token1.png',
                        decimals: 6,
                        supply: '1000000'
                    },
                    {
                        address: 'token2',
                        name: 'Test Token 2', 
                        symbol: 'TT2',
                        icon: 'https://example.com/token2.png',
                        decimals: 9,
                        supply: '2000000'
                    }
                ]),
                solscanTokenInfoToTokenInfo: jest.fn().mockImplementation((solscanToken) => ({
                    token_address: solscanToken.address,
                    name: solscanToken.name,
                    symbol: solscanToken.symbol,
                    decimals: solscanToken.decimals,
                    total_supply: Number(solscanToken.supply),
                    sol_scan_image: solscanToken.icon
                }))
            };

            mockSolScanAPi.mockImplementation(() => mockSolscanInstance as any);

            // Mock batchUpdateTokenInfo success
            jest.doMock('../service/TokenInfoService', () => ({
                ...jest.requireActual('../service/TokenInfoService'),
                batchUpdateTokenInfo: jest.fn().mockResolvedValue({
                    successCount: 2,
                    failedTokens: []
                })
            }));

            const result = await updateEmptySolScanImageTokens();

            expect(result.processedCount).toBe(2);
            expect(result.totalEmptyTokens).toBe(2);
            expect(mockSolscanInstance.getMultiTokenInfo).toHaveBeenCalledWith(['token1', 'token2']);

        }, 10000); // Increase timeout for this test

        it('should handle API errors gracefully', async () => {
            const mockTokenData = [{
                token_address: 'token1',
                name: 'Test Token 1',
                symbol: 'TT1', 
                decimals: 6,
                total_supply: 1000000,
                sol_scan_image: null
            }];

            mockGetTokensWithEmptySolScanImage
                .mockResolvedValueOnce({
                    data: mockTokenData,
                    total: 1,
                    pageNum: 1,
                    pageSize: 20,
                    totalPages: 1
                })
                .mockResolvedValueOnce({
                    data: [],
                    total: 1,
                    pageNum: 2,
                    pageSize: 20,
                    totalPages: 1
                });

            // Mock SolScan API to throw error
            const mockSolscanInstance = {
                getMultiTokenInfo: jest.fn().mockRejectedValue(new Error('API Error'))
            };

            mockSolScanAPi.mockImplementation(() => mockSolscanInstance as any);

            const result = await updateEmptySolScanImageTokens();

            expect(result.processedCount).toBe(1);
            expect(result.failedCount).toBe(1);
            expect(result.successCount).toBe(0);
        });
    });
}); 