import type { Request, Response } from 'express';
import { WebchatDomainsService } from './webchat-domains.service';
export declare class PublicAdsTxtController {
    private readonly service;
    constructor(service: WebchatDomainsService);
    serveAdsTxt(req: Request, res: Response, hostHeader?: string): Promise<void>;
}
