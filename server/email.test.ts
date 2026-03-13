/**
 * Tests für E-Mail-Versand-Hilfsfunktionen
 */
import { describe, it, expect } from 'vitest';
import { buildOfferEmailHtml } from './email';

describe('buildOfferEmailHtml', () => {
  it('enthält die Angebotsnummer', () => {
    const html = buildOfferEmailHtml({
      invoiceNumber: 'AN-2026-0001',
      emailBody: 'Testtext',
    });
    expect(html).toContain('AN-2026-0001');
  });

  it('enthält den E-Mail-Body', () => {
    const html = buildOfferEmailHtml({
      invoiceNumber: 'AN-2026-0001',
      emailBody: 'Sehr geehrter Herr Müller',
    });
    expect(html).toContain('Sehr geehrter Herr Müller');
  });

  it('enthält die Signatur wenn angegeben', () => {
    const html = buildOfferEmailHtml({
      invoiceNumber: 'AN-2026-0001',
      emailBody: 'Test',
      emailSignature: 'Mit freundlichen Grüßen\nDaniel Rincón',
    });
    expect(html).toContain('Mit freundlichen Grüßen');
    expect(html).toContain('Daniel Rincón');
  });

  it('enthält Gesamtbetrag wenn angegeben', () => {
    const html = buildOfferEmailHtml({
      invoiceNumber: 'AN-2026-0001',
      emailBody: 'Test',
      totalGross: '1234.56',
    });
    expect(html).toContain('1.234,56');
  });

  it('enthält Firmenname als Anrede wenn kein Empfänger', () => {
    const html = buildOfferEmailHtml({
      invoiceNumber: 'AN-2026-0001',
      emailBody: 'Test',
    });
    expect(html).toContain('Sehr geehrte Damen und Herren');
  });

  it('enthält personalisierte Anrede wenn Empfänger angegeben', () => {
    const html = buildOfferEmailHtml({
      invoiceNumber: 'AN-2026-0001',
      emailBody: 'Test',
      recipientName: 'Max Mustermann',
    });
    expect(html).toContain('Max Mustermann');
  });

  it('enthält kein Signatur-Block wenn keine Signatur', () => {
    const html = buildOfferEmailHtml({
      invoiceNumber: 'AN-2026-0001',
      emailBody: 'Test',
    });
    expect(html).not.toContain('border-top:1px solid');
  });

  it('generiert valides HTML-Dokument', () => {
    const html = buildOfferEmailHtml({
      invoiceNumber: 'AN-2026-0001',
      emailBody: 'Test',
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });
});
