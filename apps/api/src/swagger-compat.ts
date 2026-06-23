export function ApiBearerAuth(): ClassDecorator & MethodDecorator {
  return () => undefined;
}

export function ApiConsumes(..._types: string[]): ClassDecorator & MethodDecorator {
  return () => undefined;
}

export function ApiProperty(_options?: Record<string, unknown>): PropertyDecorator {
  return () => undefined;
}

export function ApiTags(..._tags: string[]): ClassDecorator {
  return () => undefined;
}
