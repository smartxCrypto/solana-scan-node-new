import RedisClient from "../constant/config/redis";
describe('redis test', () => {
    test('should connect to redis', async () => {
        const redis = RedisClient;
        await redis.client.set('test', 'test');
        const value = await redis.client.get('test');
        expect(value).toBe('test');
    })
})