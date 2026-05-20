import { EcgRecord } from './types';
export { decodeRecord } from '../shared/wireFormat';
export interface SampleInfo {
    id: string;
    file: string;
}
export declare function configureApi(opts: {
    baseUrl?: string;
}): void;
export declare function listSamples(): Promise<SampleInfo[]>;
export declare function loadSample(id: string): Promise<EcgRecord>;
export declare function uploadDicom(file: File): Promise<EcgRecord>;
