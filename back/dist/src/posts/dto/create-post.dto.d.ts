export declare enum PostTypeEnum {
    SINGLE_IMAGE = "SINGLE_IMAGE",
    SINGLE_VIDEO = "SINGLE_VIDEO",
    CAROUSEL = "CAROUSEL"
}
export declare class CreatePostDto {
    internal_name: string;
    post_type: PostTypeEnum;
    default_title?: string;
    default_caption?: string;
    tags?: string;
}
