/**
 * Vendor API — Renderer-safe IPC wrapper
 *
 * 渲染进程通过 window.ipcRenderer.invoke 调用主进程的 vendor 操作
 */

import type { VendorConfig } from './vendor'

export async function compileVendorIPC(config: VendorConfig): Promise<string | null> {
  try {
    return await window.ipcRenderer.invoke('vendor:compile', config)
  } catch {
    console.warn('[VendorAPI] compile failed (IPC not available)')
    return null
  }
}

export async function testVendorIPC(config: VendorConfig): Promise<{ success: boolean; output: string }> {
  try {
    return await window.ipcRenderer.invoke('vendor:test', config)
  } catch {
    return { success: false, output: 'IPC not available' }
  }
}
