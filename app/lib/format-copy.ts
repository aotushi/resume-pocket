/**
 * 全站共用的「支持什么文件」口径：首页、上传区、服务与隐私说明、接口报错都从这里取。
 * 支持的格式或大小变了，只改这里和 resume-policy.ts 的校验，不要在页面里另写一份。
 * 本文件不依赖其他模块，resume-policy.ts 的大小上限也从这里取，避免循环引用。
 */
export const MAX_SIZE_MB = 10;
export const MAX_SIZE_TEXT = `${MAX_SIZE_MB} MB`;

/** 游客只能上传的格式 */
export const GUEST_FORMATS = "PDF";
/** 注册用户可上传的格式：「或」用于选择、上传语境 */
export const USER_FORMATS = "PDF 或 Word";
/** 并列列举语境，如表格单元格、「在…之外」 */
export const USER_FORMATS_LIST = "PDF、Word";
/** 带扩展名的完整说法，用于格式校验报错和 FAQ */
export const USER_FORMATS_DETAIL = "PDF 或 Word（DOCX、DOC）";

export const GUEST_FORMAT_ERROR = `游客空间只支持 ${GUEST_FORMATS}，注册后即可上传 Word 简历`;
export const FORMAT_ERROR = `请选择 ${USER_FORMATS_DETAIL} 格式的简历`;
export const GUEST_PICK_ERROR = `请选择 ${GUEST_FORMATS} 格式的简历`;
export const SIZE_ERROR = `文件不能超过 ${MAX_SIZE_TEXT}`;
