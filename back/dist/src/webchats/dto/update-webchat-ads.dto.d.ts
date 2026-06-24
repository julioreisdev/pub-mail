declare class WebchatAdPayloadDto {
    id?: string;
    codigo_tag?: string;
    codigo?: string;
    gpt_slot?: string;
    gpt_div_id?: string;
    gpt_sizes?: any;
    anuncio_fixed?: string;
    html?: string;
    ativo?: boolean;
}
declare class WebchatBetweenMessagesPayloadDto extends WebchatAdPayloadDto {
    intervalo_mensagens?: number;
    sequence_ads?: WebchatAdPayloadDto[];
}
export declare class UpdateWebchatAdsDto {
    topo?: WebchatAdPayloadDto;
    rodape?: WebchatAdPayloadDto;
    intersticial?: WebchatAdPayloadDto;
    entre_mensagens?: WebchatBetweenMessagesPayloadDto;
}
export {};
