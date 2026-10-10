/** 저장 보호 거절은 앱 사용을 막지 않는다. */
export async function requestStorageProtection(storage?: Pick<StorageManager, 'persist'>): Promise<void> {
  try { const manager = storage ?? navigator.storage; if (typeof manager?.persist === 'function') await manager.persist(); } catch { /* 브라우저가 거절해도 기록 흐름을 유지한다. */ }
}
