declare const AD_EVENT_NAMES: readonly ["requested", "rendered", "empty", "viewable", "clicked", "closed", "error"];
declare const AD_POSITIONS: readonly ["topo", "rodape", "intersticial", "entre-mensagens"];
export declare class TrackWebchatAdEventDto {
    event_name: (typeof AD_EVENT_NAMES)[number];
    ad_position: (typeof AD_POSITIONS)[number];
    ad_key?: string;
    payload?: Record<string, any>;
}
export declare class TrackWebchatAdEventsDto {
    session_id?: string;
    domain?: string;
    events: TrackWebchatAdEventDto[];
}
export {};
