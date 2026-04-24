export function withTimestamp<T extends object>(data: T): T & { updatedAt: string } {
  return { ...data, updatedAt: new Date().toISOString() };
}

export function softDelete(): { deletedAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return { deletedAt: now, updatedAt: now };
}

