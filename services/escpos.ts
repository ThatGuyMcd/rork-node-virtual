import type { Transaction, PrinterPaperWidth, ReceiptSettings, ReceiptLineSize } from '@/types/pos';

export class ESCPOSGenerator {
  private commands = {
    ESC: '\x1B',
    GS: '\x1D',
    LF: '\n',
    CR: '\r',
  };

  private paperWidth: PrinterPaperWidth;
  private charsPerLine: number;

  constructor(paperWidth: PrinterPaperWidth = '80mm') {
    this.paperWidth = paperWidth;
    this.charsPerLine = paperWidth === '58mm' ? 32 : 48;
  }

  private init(): string {
    return this.commands.ESC + '@';
  }

  private alignCenter(): string {
    return this.commands.ESC + 'a' + '\x01';
  }

  private alignLeft(): string {
    return this.commands.ESC + 'a' + '\x00';
  }

  private alignRight(): string {
    return this.commands.ESC + 'a' + '\x02';
  }

  private bold(enable: boolean): string {
    return this.commands.ESC + 'E' + (enable ? '\x01' : '\x00');
  }

  private doubleWidth(enable: boolean): string {
    return this.commands.ESC + '!' + (enable ? '\x20' : '\x00');
  }

  private doubleHeight(enable: boolean): string {
    return this.commands.ESC + '!' + (enable ? '\x10' : '\x00');
  }

  private doubleSize(enable: boolean): string {
    return this.commands.ESC + '!' + (enable ? '\x30' : '\x00');
  }

  private setTextSize(size: ReceiptLineSize): string {
    switch (size) {
      case 'small':
        return this.commands.ESC + '!' + '\x00';
      case 'normal':
        return this.commands.ESC + '!' + '\x00';
      case 'large':
        return this.commands.ESC + '!' + '\x30';
    }
  }

  private underline(enable: boolean): string {
    return this.commands.ESC + '-' + (enable ? '\x01' : '\x00');
  }

  private cutPaper(): string {
    return this.commands.GS + 'V' + '\x41' + '\x03';
  }

  private feed(lines: number = 1): string {
    return this.commands.ESC + 'd' + String.fromCharCode(lines);
  }

  private padRight(text: string, width: number): string {
    return text + ' '.repeat(Math.max(0, width - text.length));
  }

  private padLeft(text: string, width: number): string {
    return ' '.repeat(Math.max(0, width - text.length)) + text;
  }

  private centerText(text: string): string {
    const padding = Math.max(0, Math.floor((this.charsPerLine - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  private formatLine(left: string, right: string): string {
    const totalWidth = this.charsPerLine;
    const rightWidth = right.length;
    const leftWidth = totalWidth - rightWidth;
    
    if (left.length > leftWidth) {
      left = left.substring(0, leftWidth - 3) + '...';
    }
    
    return this.padRight(left, leftWidth) + right;
  }

  private divider(char: string = '-'): string {
    return char.repeat(this.charsPerLine) + this.commands.LF;
  }

  generateReceipt(transaction: Transaction, siteName?: string, isReprint: boolean = false, customSettings?: ReceiptSettings): Uint8Array {
    let receipt = '';

    receipt += this.init();
    receipt += this.alignCenter();

    if (customSettings && customSettings.headerLines.length > 0) {
      customSettings.headerLines.forEach((line) => {
        receipt += this.setTextSize(line.size);
        receipt += line.text + this.commands.LF;
      });
      receipt += this.setTextSize('normal');
    } else {
      receipt += this.doubleSize(true);
      receipt += (siteName || 'RECEIPT') + this.commands.LF;
      receipt += this.doubleSize(false);
    }
    
    if (isReprint) {
      receipt += this.bold(true);
      receipt += '*** REPRINT ***' + this.commands.LF;
      receipt += this.bold(false);
    }
    
    receipt += this.feed(1);

    receipt += this.alignLeft();
    receipt += this.divider('=');

    const date = new Date(transaction.timestamp);
    receipt += this.formatLine('Date:', date.toLocaleDateString('en-GB')) + this.commands.LF;
    receipt += this.formatLine('Time:', date.toLocaleTimeString('en-GB')) + this.commands.LF;
    receipt += this.formatLine('Transaction:', transaction.id.substring(0, 16)) + this.commands.LF;
    receipt += this.formatLine('Operator:', transaction.operatorName) + this.commands.LF;
    
    if (transaction.tableName) {
      receipt += this.formatLine('Table:', transaction.tableName) + this.commands.LF;
    }
    
    receipt += this.divider('=');

    receipt += this.bold(true);
    receipt += `Items (${transaction.items.length})` + this.commands.LF;
    receipt += this.bold(false);
    receipt += this.divider('-');

    transaction.items.forEach((item) => {
      const prefix = this.getPricePrefix(item.selectedPrice.label);
      const itemName = prefix ? `${prefix} ${item.product.name}` : item.product.name;
      const quantity = Math.abs(item.quantity);
      const price = Math.abs(item.selectedPrice.price);
      const total = Math.abs(item.lineTotal);
      
      receipt += itemName + this.commands.LF;
      
      const quantityLine = `${quantity} × £${price.toFixed(2)}`;
      const totalLine = `£${total.toFixed(2)}`;
      receipt += this.formatLine(quantityLine, totalLine) + this.commands.LF;
    });

    receipt += this.divider('-');

    const subtotal = Math.abs(transaction.subtotal);
    receipt += this.formatLine('Subtotal', `£${subtotal.toFixed(2)}`) + this.commands.LF;

    if (transaction.discount && transaction.discount > 0) {
      receipt += this.formatLine('Discount', `-£${transaction.discount.toFixed(2)}`) + this.commands.LF;
    }

    if (transaction.gratuity && transaction.gratuity > 0) {
      receipt += this.formatLine('Gratuity', `+£${transaction.gratuity.toFixed(2)}`) + this.commands.LF;
    }

    const vatTotal = Object.values(transaction.vatBreakdown).reduce((sum, vat) => sum + vat, 0);
    if (vatTotal > 0) {
      receipt += this.formatLine('VAT', `£${vatTotal.toFixed(2)}`) + this.commands.LF;
    }

    receipt += this.divider('=');
    receipt += this.bold(true);
    receipt += this.doubleWidth(true);
    const total = Math.abs(transaction.total);
    receipt += this.formatLine('TOTAL', `£${total.toFixed(2)}`) + this.commands.LF;
    receipt += this.doubleWidth(false);
    receipt += this.bold(false);
    receipt += this.divider('=');

    if (transaction.payments && transaction.payments.length > 0) {
      receipt += this.bold(true);
      receipt += 'Payment Methods:' + this.commands.LF;
      receipt += this.bold(false);
      transaction.payments.forEach((payment) => {
        receipt += this.formatLine(`  ${payment.tenderName}`, `£${payment.amount.toFixed(2)}`) + this.commands.LF;
      });
    } else {
      receipt += this.bold(true);
      receipt += `Payment Method: ${transaction.tenderName}` + this.commands.LF;
      receipt += this.bold(false);
    }

    if (transaction.cashback && transaction.cashback > 0) {
      receipt += this.feed(1);
      let lastPaymentTender = transaction.tenderName;
      if (transaction.payments && transaction.payments.length > 0) {
        const lastPayment = transaction.payments[transaction.payments.length - 1];
        lastPaymentTender = lastPayment.tenderName;
      }
      const isCash = lastPaymentTender === 'Cash';
      const label = isCash ? 'CHANGE' : 'CASHBACK';
      receipt += this.bold(true);
      receipt += this.formatLine(label, `£${transaction.cashback.toFixed(2)}`) + this.commands.LF;
      receipt += this.bold(false);
    }

    if (transaction.isRefund) {
      receipt += this.feed(1);
      receipt += this.alignCenter();
      receipt += this.bold(true);
      receipt += '*** REFUND ***' + this.commands.LF;
      receipt += this.bold(false);
      receipt += this.alignLeft();
    }

    receipt += this.feed(1);
    receipt += this.alignCenter();

    if (customSettings && customSettings.footerLines.length > 0) {
      customSettings.footerLines.forEach((line) => {
        receipt += this.setTextSize(line.size);
        receipt += line.text + this.commands.LF;
      });
      receipt += this.setTextSize('normal');
    } else {
      receipt += 'Thank you for your visit!' + this.commands.LF;
    }

    receipt += this.feed(3);

    receipt += this.cutPaper();

    return new TextEncoder().encode(receipt);
  }

  generateReceiptText(transaction: Transaction, siteName?: string, receiptSettings?: ReceiptSettings, terminalId?: string, terminalName?: string): string {
    let receipt = '';

    if (receiptSettings && receiptSettings.headerLines.length > 0) {
      receiptSettings.headerLines.forEach((line) => {
        receipt += this.centerText(line.text) + '\r\n';
      });
    } else {
      receipt += this.centerText(siteName || 'RECEIPT') + '\r\n';
    }
    
    receipt += '=' .repeat(this.charsPerLine) + '\r\n\r\n';

    transaction.items.forEach((item) => {
      const prefix = this.getPricePrefix(item.selectedPrice.label);
      const itemName = prefix ? `${prefix} ${item.product.name}` : item.product.name;
      const quantity = Math.abs(item.quantity);
      const total = Math.abs(item.lineTotal);
      
      receipt += `${quantity} x ${itemName}`.padEnd(this.charsPerLine - 7) + `£${total.toFixed(2)}`.padStart(7) + '\r\n';
    });

    receipt += '\r\n';
    const subtotal = Math.abs(transaction.subtotal);
    receipt += 'Total (inc VAT): '.padEnd(this.charsPerLine - 7) + `£${subtotal.toFixed(2)}`.padStart(7) + '\r\n';
    receipt += 'Subtotal: '.padEnd(this.charsPerLine - 7) + `£${subtotal.toFixed(2)}`.padStart(7) + '\r\n';
    receipt += '=' .repeat(this.charsPerLine) + '\r\n';

    if (transaction.payments && transaction.payments.length > 0) {
      transaction.payments.forEach((payment) => {
        receipt += `Paid By: ${payment.tenderName}`.padEnd(this.charsPerLine) + '\r\n';
        receipt += `Amount Paid: £${payment.amount.toFixed(2)}`.padEnd(this.charsPerLine) + '\r\n';
      });
    } else {
      receipt += `Paid By: ${transaction.tenderName}`.padEnd(this.charsPerLine) + '\r\n';
      const total = Math.abs(transaction.total);
      receipt += `Amount Paid: £${total.toFixed(2)}`.padEnd(this.charsPerLine) + '\r\n';
    }

    if (transaction.cashback && transaction.cashback > 0) {
      receipt += `Change: £${transaction.cashback.toFixed(2)}`.padEnd(this.charsPerLine) + '\r\n';
    } else {
      receipt += 'Change: £0.00'.padEnd(this.charsPerLine) + '\r\n';
    }
    
    receipt += '=' .repeat(this.charsPerLine) + '\r\n';

    Object.entries(transaction.vatBreakdown).forEach(([vatCode, vatAmount]) => {
      receipt += `CODE = ${vatCode} - STANDARD: £${vatAmount.toFixed(2)}`.padEnd(this.charsPerLine) + '\r\n';
      receipt += `VAT Total: £${vatAmount.toFixed(2)}`.padEnd(this.charsPerLine) + '\r\n';
    });

    receipt += '=' .repeat(this.charsPerLine) + '\r\n';
    receipt += `Served by: ${transaction.operatorName}\r\n`;
    
    if (terminalId && terminalName) {
      receipt += `Terminal ID: ${terminalId} - ${terminalName}\r\n`;
    }
    
    receipt += `Transaction ID: ${transaction.id}\r\n`;
    
    const date = new Date(transaction.timestamp);
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    receipt += `Time/Date: ${timeStr} / ${dateStr}\r\n`;
    receipt += '=' .repeat(this.charsPerLine) + '\r\n\r\n';

    if (receiptSettings && receiptSettings.footerLines.length > 0) {
      receiptSettings.footerLines.forEach((line) => {
        receipt += this.centerText(line.text) + '\r\n';
      });
    } else {
      receipt += this.centerText('Thank you') + '\r\n';
      receipt += this.centerText('for visiting us!') + '\r\n';
    }

    return receipt;
  }

  private getPricePrefix(label: string): string {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel === 'standard') return '';
    if (lowerLabel === 'double') return 'DBL';
    if (lowerLabel === 'small') return 'SML';
    if (lowerLabel === 'large') return 'LRG';
    if (lowerLabel === 'half') return 'HALF';
    if (lowerLabel === 'schooner') return '2/3PT';
    if (label === '125ml' || label === '175ml' || label === '250ml') return label;
    return label === 'standard' ? '' : label;
  }

  generateTestReceipt(): Uint8Array {
    let receipt = '';

    receipt += this.init();
    receipt += this.alignCenter();
    receipt += this.doubleSize(true);
    receipt += 'TEST PRINT' + this.commands.LF;
    receipt += this.doubleSize(false);
    receipt += this.feed(1);

    receipt += this.alignLeft();
    receipt += this.divider('=');
    
    receipt += `Paper Width: ${this.paperWidth}` + this.commands.LF;
    receipt += `Characters per line: ${this.charsPerLine}` + this.commands.LF;
    receipt += `Date: ${new Date().toLocaleString('en-GB')}` + this.commands.LF;

    receipt += this.divider('=');

    receipt += this.alignCenter();
    receipt += this.bold(true);
    receipt += 'Printer Test Successful!' + this.commands.LF;
    receipt += this.bold(false);

    receipt += this.feed(3);
    receipt += this.cutPaper();

    return new TextEncoder().encode(receipt);
  }
}
