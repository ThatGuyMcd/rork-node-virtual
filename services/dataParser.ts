export interface ParsedData {
  operators: any[];
  groups: any[];
  departments: any[];
  products: any[];
  tenders: any[];
  vatRates: any[];
}

export class DataParser {
  parseKV(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    const lines = text.split(/[\r\n]+/);
    
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) continue;
      
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      out[key] = val;
    }
    
    return out;
  }

  parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let i = 0;
    let cell = '';
    let row: string[] = [];
    let inQ = false;
    
    while (i < text.length) {
      const c = text[i];
      
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          inQ = false;
          i++;
          continue;
        } else {
          cell += c;
          i++;
          continue;
        }
      } else {
        if (c === '"') {
          inQ = true;
          i++;
          continue;
        }
        if (c === ',') {
          row.push(cell);
          cell = '';
          i++;
          continue;
        }
        if (c === '\r') {
          if (text[i + 1] === '\n') i++;
          row.push(cell);
          rows.push(row);
          row = [];
          cell = '';
          i++;
          continue;
        }
        if (c === '\n') {
          row.push(cell);
          rows.push(row);
          row = [];
          cell = '';
          i++;
          continue;
        }
        cell += c;
        i++;
      }
    }
    
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    
    return rows;
  }

  parseColor(s: string | null | undefined): string | null {
    if (!s) return null;
    s = String(s).trim();
    
    // Hex color
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
    
    // VB Color notation
    const m = s.match(/R\s*=\s*(\d+)[^\d]+G\s*=\s*(\d+)[^\d]+B\s*=\s*(\d+)/i);
    if (m) return `rgb(${m[1]}, ${m[2]}, ${m[3]})`;
    
    // Extract RGB numbers
    const nums = s.split(/[^0-9]+/).filter(Boolean).map(n => parseInt(n, 10));
    if (nums.length >= 3) {
      const r = nums[nums.length - 3];
      const g = nums[nums.length - 2];
      const b = nums[nums.length - 1];
      if ([r, g, b].every(v => v >= 0 && v <= 255)) {
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    
    return s;
  }

  parsePriceOptions(kv: Record<string, string>): { key: string; label: string; price: number }[] {
    const options: { key: string; label: string; price: number }[] = [];
    const keys = Object.keys(kv).filter(k => /^PRICE_/i.test(k));
    
    console.log('[DataParser] Parsing prices for product:', kv.PRODUCT_DESCRIPTION || 'Unknown');
    console.log('[DataParser] Found PRICE_ keys:', keys);
    
    for (const key of keys) {
      const raw = String(kv[key] || '').trim();
      const label = key.replace(/^PRICE_/i, '').replace(/_/g, ' ').trim() || 'standard';
      
      console.log(`[DataParser] Processing ${key}: "${raw}" -> label: "${label}"`);
      
      if (label.toLowerCase() === 'promo') {
        console.log(`[DataParser] Skipping promo price`);
        continue;
      }
      
      if (/^not\s*set$/i.test(raw)) {
        console.log(`[DataParser] Adding NOT SET price`);
        options.push({ key, label: 'NOT SET', price: 0 });
        continue;
      }
      
      if (/^open$/i.test(raw)) {
        console.log(`[DataParser] Adding OPEN price`);
        options.push({ key, label: 'OPEN', price: 0 });
        continue;
      }
      
      const num = parseFloat(raw);
      if (!isFinite(num) || num < 0) {
        console.log(`[DataParser] Skipping invalid number: ${raw}`);
        continue;
      }
      if (num === 0 && label.toLowerCase() !== 'standard') {
        console.log(`[DataParser] Skipping zero price for non-standard: ${label}`);
        continue;
      }
      
      console.log(`[DataParser] Adding price: ${label.toLowerCase()} = ${num}`);
      options.push({ key, label: label.toLowerCase(), price: num });
    }
    
    options.sort((a, b) => a.price - b.price);
    const seen = new Set<string>();
    const out: { key: string; label: string; price: number }[] = [];
    
    for (const opt of options) {
      const sig = `${opt.key}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        out.push(opt);
      }
    }
    
    console.log(`[DataParser] Final prices:`, out);
    
    return out;
  }
}

export const dataParser = new DataParser();
