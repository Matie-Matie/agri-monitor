import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

// Code128 barcode for a product SKU (what the USB scanner reads into the POS).
export default function Barcode({ value, height = 40, width = 1.6 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, String(value), { format: 'CODE128', displayValue: false, height, width, margin: 0 });
    } catch { /* unencodable value: leave blank */ }
  }, [value, height, width]);
  return <svg ref={ref} className="max-w-full" />;
}
