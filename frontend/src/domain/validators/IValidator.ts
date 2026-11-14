export interface ValidationResult<TErrorMap> {
  readonly isValid: boolean;
  readonly errors: TErrorMap;
}

export interface IValidator<TInput, TErrorMap> {
  validate(input: TInput): ValidationResult<TErrorMap>;
}
