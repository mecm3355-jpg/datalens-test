export class AppError extends Error {
  readonly code: string;

  /** 사용자에게 설명 가능한 오류 코드와 메시지로 애플리케이션 오류를 생성합니다. */
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
  }
}
