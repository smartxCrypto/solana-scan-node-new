import { blob, Layout } from '@solana/buffer-layout';
import { Buffer } from 'node:buffer';
import { PublicKey } from '@solana/web3.js';

export const pubKey = (property: string): Layout<PublicKey> => {
    const layout = blob(32, property);
    const pubKeyLayout = layout as Layout<unknown> as Layout<PublicKey>;
    const decode = layout.decode.bind(layout);
    pubKeyLayout.decode = (buffer: Buffer, offset: number) => {
        const src = decode(buffer, offset);
        return new PublicKey(src);
    };
    return pubKeyLayout;
};

export const uint8 = (property: string): Layout<number> => {
    const layout = blob(1, property);
    const uint8Layout = layout as Layout<unknown> as Layout<number>;
    const decode = layout.decode.bind(layout);
    uint8Layout.decode = (buffer: Buffer, offset: number) => {
        const src = decode(buffer, offset);
        return src[0];
    };
    return uint8Layout;
};

export const uint16 = (property: string): Layout<number> => {
    const layout = blob(2, property);
    const uint16Layout = layout as Layout<unknown> as Layout<number>;
    const decode = layout.decode.bind(layout);
    uint16Layout.decode = (buffer: Buffer, offset: number) => {
        const src = decode(buffer, offset);
        return Buffer.from(src).readUInt16LE();
    };
    return uint16Layout;
};

export const uint32 = (property: string): Layout<number> => {
    const layout = blob(4, property);
    const uint32Layout = layout as Layout<unknown> as Layout<number>;
    const decode = layout.decode.bind(layout);
    uint32Layout.decode = (buffer: Buffer, offset: number) => {
        const src = decode(buffer, offset);
        return Buffer.from(src).readUInt32LE();
    };
    return uint32Layout;
};

export const uint64 = (property: string): Layout<bigint> => {
    const layout = blob(8, property);
    const uint64Layout = layout as Layout<unknown> as Layout<bigint>;
    const decode = layout.decode.bind(layout);
    uint64Layout.decode = (buffer: Buffer, offset: number) => {
        const src = decode(buffer, offset);
        return Buffer.from(src).readBigUInt64LE();
    };
    return uint64Layout;
};

export const uint128 = (property: string): Layout<bigint> => {
    const layout = blob(16, property);
    const uint128Layout = layout as Layout<unknown> as Layout<bigint>;
    const decode = layout.decode.bind(layout);
    uint128Layout.decode = (buffer: Buffer, offset: number) => {
        const src = decode(buffer, offset);
        return Buffer.from(src).readBigUInt64LE();
    };
    return uint128Layout;
};

export const stringLayout = (property: string): Layout<string> => {
    const layout = blob(4, property);
    const stringLayout = layout as Layout<unknown> as Layout<string>;

    stringLayout.decode = (buffer: Buffer, offset: number) => {
        const length = buffer.readUInt32LE(offset);
        return buffer.slice(offset + 4, offset + 4 + length).toString('utf-8');
    };

    stringLayout.getSpan = (buffer: Buffer, offset: number) => {
        const length = buffer.readUInt32LE(offset);
        return 4 + length;
    };

    return stringLayout;
};

export const boolean = (property: string): Layout<boolean> => {
    const layout = blob(1, property);
    const booleanLayout = layout as Layout<unknown> as Layout<boolean>;
    const decode = layout.decode.bind(layout);
    booleanLayout.decode = (buffer: Buffer, offset: number) => {
        const src = decode(buffer, offset);
        return src[0] === 1;
    };
    return booleanLayout;
};
