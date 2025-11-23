import 'module-alias/register';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
    console.log('🚀 Solana Collection Node.js Application Starting...');
    
    // You can import and start your services here
    // For example:
    // import { snapshotScheduler } from '@/cron/snapshot/index';
    // import { smartMoneyCronJob } from '@/cron/smart-money/index';
    
    console.log('✅ Application initialized successfully');
    
    // Keep the process running
    process.on('SIGINT', () => {
        console.log('\n📤 Received SIGINT, shutting down gracefully...');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n📤 Received SIGTERM, shutting down gracefully...');
        process.exit(0);
    });
}

main().catch((error) => {
    console.error('❌ Application failed to start:', error);
    process.exit(1);
}); 