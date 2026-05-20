import { EcgRecord } from './ecgTypes';
/**
 * Serialize a record into the binary wire format. Returns a Uint8Array whose
 * underlying buffer is the contiguous payload — pass it as the HTTP body.
 */
export declare function encodeRecord(record: EcgRecord): Uint8Array;
/**
 * Decode the wire format produced by `encodeRecord`. Sample arrays are
 * zero-copy `Float32Array` views over the input buffer.
 */
export declare function decodeRecord(input: ArrayBuffer | Uint8Array): EcgRecord;
/**
 * Clip every channel to the first `maxSeconds` of recording. No-op if the
 * record is already shorter. Shares the underlying sample buffer (via
 * `Float32Array.subarray`) — does not copy.
 */
export declare function truncateRecord(record: EcgRecord, maxSeconds: number): EcgRecord;
