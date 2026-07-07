/**
 * Native barcode scanning via @capacitor-mlkit/barcode-scanning.
 *
 * Uses the plugin's `scan()` one-shot API: on Android this is the Google
 * code scanner (own fullscreen UI with torch + autofocus, on-device ML Kit,
 * no CAMERA permission required); on iOS it presents the plugin's scanner
 * UI (requires NSCameraUsageDescription, added to Info.plist).
 *
 * On the web build none of this is reachable — `isNativeScannerAvailable()`
 * gates every call and the scan screen falls back to manual entry.
 */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import {
  BarcodeFormat,
  BarcodeScanner,
} from '@capacitor-mlkit/barcode-scanning'

/** Retail formats only (PRD F1): EAN-8/13, UPC-A/E. */
const RETAIL_FORMATS = [
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
]

export function isNativeScannerAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

export type ScanOutcome =
  | { status: 'scanned'; barcode: string }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

/**
 * Open the native scanner and resolve with a single barcode.
 * Fires a light haptic on successful detection.
 */
export async function scanOnce(): Promise<ScanOutcome> {
  if (!isNativeScannerAvailable()) return { status: 'unavailable' }

  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: RETAIL_FORMATS })
    const value = barcodes[0]?.rawValue?.trim()
    if (!value) return { status: 'cancelled' }
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined)
    return { status: 'scanned', barcode: value }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // The plugin rejects with "canceled" when the user closes the scanner.
    if (/cancel/i.test(message)) return { status: 'cancelled' }
    return { status: 'error', message }
  }
}
