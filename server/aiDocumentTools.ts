/**
 * aiDocumentTools.ts
 * KI-gestützte Angebots- und Rechnungserstellung per Prompt (Function Calling).
 * Diese Datei ist vollständig isoliert — sie importiert nur aus db.ts und _core/llm.ts.
 * Kein bestehender Code wurde verändert.
 */

import { invokeLLM } from "./_core/llm";
import {
  getCustomers,
  getCustomerById,
  getCompanySettings,
  createInvoice,
  getNextInvoiceNumber,
} from "./db";

// ─── Tool-Definitionen für Function Calling ──────────────────────────────────

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_customer",
      description: "Sucht einen Kunden in der Datenbank anhand von Name oder Firma. Gibt eine Liste passender Kunden zurück.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Name oder Firma des Kunden (Teilstring reicht)",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_document",
      description: "Erstellt ein Angebot oder eine Rechnung im ERP-System als Entwurf. Gibt die neue Dokument-ID und Nummer zurück.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["offer", "invoice"],
            description: "Dokumenttyp: 'offer' für Angebot, 'invoice' für Rechnung",
          },
          customerId: {
            type: "number",
            description: "ID des Kunden aus search_customer",
          },
          recipientName: {
            type: "string",
            description: "Name des Empfängers (Ansprechpartner)",
          },
          recipientCompany: {
            type: "string",
            description: "Firmenname des Empfängers",
          },
          recipientStreet: {
            type: "string",
            description: "Straße und Hausnummer des Empfängers",
          },
          recipientZip: {
            type: "string",
            description: "Postleitzahl des Empfängers",
          },
          recipientCity: {
            type: "string",
            description: "Stadt des Empfängers",
          },
          introText: {
            type: "string",
            description: "Einleitungstext / Anschreiben für das Dokument",
          },
          paymentTerms: {
            type: "string",
            description: "Zahlungsbedingungen, z.B. 'Zahlbar innerhalb von 14 Tagen ohne Abzug.'",
          },
          items: {
            type: "array",
            description: "Positionen des Dokuments",
            items: {
              type: "object",
              properties: {
                position: { type: "number", description: "Positionsnummer (1, 2, 3, ...)" },
                description: { type: "string", description: "Bezeichnung der Position" },
                quantity: { type: "number", description: "Menge" },
                unit: { type: "string", description: "Einheit (Stk., Std., Pauschal, km, %)" },
                unitPriceNet: { type: "number", description: "Einzelpreis netto in EUR" },
                taxRate: { type: "number", description: "Steuersatz in Prozent (z.B. 19)" },
              },
              required: ["position", "description", "quantity", "unit", "unitPriceNet", "taxRate"],
              additionalProperties: false,
            },
          },
        },
        required: ["type", "items"],
        additionalProperties: false,
      },
    },
  },
];

// ─── Tool-Ausführung ──────────────────────────────────────────────────────────

async function executeSearchCustomer(query: string): Promise<string> {
  const customers = await getCustomers();
  const q = query.toLowerCase();
  const matches = (customers as any[]).filter((c: any) =>
    (c.name ?? "").toLowerCase().includes(q) ||
    (c.company ?? "").toLowerCase().includes(q) ||
    (c.email ?? "").toLowerCase().includes(q)
  ).slice(0, 5);

  if (matches.length === 0) {
    return JSON.stringify({ found: false, message: "Kein Kunde gefunden. Bitte prüfe den Namen." });
  }
  return JSON.stringify({
    found: true,
    customers: matches.map((c: any) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      street: c.street,
      zip: c.zip,
      city: c.city,
    })),
  });
}

async function executeCreateDocument(params: {
  type: "offer" | "invoice";
  customerId?: number;
  recipientName?: string;
  recipientCompany?: string;
  recipientStreet?: string;
  recipientZip?: string;
  recipientCity?: string;
  introText?: string;
  paymentTerms?: string;
  items: Array<{
    position: number;
    description: string;
    quantity: number;
    unit: string;
    unitPriceNet: number;
    taxRate: number;
  }>;
}): Promise<string> {
  try {
    const cs = await getCompanySettings();
    const today = new Date().toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

    // Empfänger-Daten aus Kunden nachladen wenn customerId vorhanden
    let recipientName = params.recipientName ?? "";
    let recipientCompany = params.recipientCompany ?? "";
    let recipientStreet = params.recipientStreet ?? "";
    let recipientZip = params.recipientZip ?? "";
    let recipientCity = params.recipientCity ?? "";

    if (params.customerId) {
      const customer = await getCustomerById(params.customerId) as any;
      if (customer) {
        recipientName = recipientName || customer.name || "";
        recipientCompany = recipientCompany || customer.company || "";
        recipientStreet = recipientStreet || customer.street || "";
        recipientZip = recipientZip || customer.zip || "";
        recipientCity = recipientCity || customer.city || "";
      }
    }

    // Positionen berechnen
    const invoiceItems = params.items.map((item) => {
      const lineTotalNet = item.quantity * item.unitPriceNet;
      const taxAmount = lineTotalNet * (item.taxRate / 100);
      return {
        position: item.position,
        description: item.description,
        quantity: String(item.quantity),
        unit: item.unit,
        unitPriceNet: String(item.unitPriceNet),
        taxRate: String(item.taxRate),
        lineTotalNet: String(lineTotalNet),
        lineTaxAmount: String(taxAmount),
        lineTotalGross: String(lineTotalNet + taxAmount),
        isOptional: false,
        longDescription: null,
        sortOrder: item.position,
      };
    });

    // Summen berechnen
    const subtotalNet = invoiceItems.reduce((s, i) => s + parseFloat(i.lineTotalNet), 0);
    const taxAmount = invoiceItems.reduce((s, i) => s + parseFloat(i.lineTaxAmount), 0);
    const totalGross = subtotalNet + taxAmount;

    // Dokument anlegen
    const invoiceData: any = {
      invoiceNumber: `ENTWURF-${Date.now()}`,
      type: params.type,
      status: "draft",
      customerId: params.customerId ?? null,
      senderName: cs?.name ?? "",
      senderStreet: cs?.street ?? null,
      senderZip: cs?.zip ?? null,
      senderCity: cs?.city ?? null,
      senderTaxId: cs?.taxNumber ?? null,
      senderVatId: cs?.vatId ?? null,
      senderEmail: cs?.email ?? null,
      senderPhone: cs?.phone ?? null,
      senderIban: cs?.iban ?? null,
      senderBic: cs?.bic ?? null,
      recipientName,
      recipientCompany: recipientCompany || null,
      recipientStreet: recipientStreet || null,
      recipientZip: recipientZip || null,
      recipientCity: recipientCity || null,
      issueDate: today,
      paymentTerms: params.paymentTerms ?? (cs?.paymentTerms ?? null),
      introText: params.introText ?? null,
      taxMode: "per_item",
      subtotalNet: String(subtotalNet),
      taxAmount: String(taxAmount),
      totalGross: String(totalGross),
      currency: "EUR",
    };

    const result = await createInvoice(invoiceData, invoiceItems, "KI-Assistent") as any;
    const newId = result?.insertId ?? result?.id ?? null;

    return JSON.stringify({
      success: true,
      documentId: newId,
      type: params.type,
      recipient: recipientCompany || recipientName,
      itemCount: invoiceItems.length,
      totalGross: totalGross.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      message: `${params.type === "offer" ? "Angebot" : "Rechnung"} erfolgreich als Entwurf erstellt.`,
    });
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err?.message ?? "Unbekannter Fehler" });
  }
}

// ─── Haupt-Funktion ───────────────────────────────────────────────────────────

export async function runAiDocumentChat(messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<{
  reply: string;
  documentCreated?: { type: string; id: number | null; recipient: string; totalGross: string };
}> {
  const systemPrompt = `Du bist ein ERP-Assistent für Daniel Rincón, Geschäftsführer der Fabrica GmbH (3D-Druck, CNC, Modellbau).
Du kannst Angebote und Rechnungen direkt im System erstellen.

Vorgehensweise:
1. Wenn der Nutzer ein Angebot oder eine Rechnung erstellen möchte, frage zuerst nach dem Kunden (search_customer).
2. Wenn der Kunde gefunden wurde, bestätige die Kundendaten kurz.
3. Sammle alle Positionen (Bezeichnung, Menge, Einheit, Einzelpreis netto, Steuersatz).
4. Wenn alle Daten vollständig sind, erstelle das Dokument (create_document).
5. Nach der Erstellung gib eine kurze Bestätigung mit Gesamtbetrag aus.

Wichtige Regeln:
- Preise immer als Netto-Beträge erfassen
- Standardsteuersatz: 19%
- Einheiten: Stk., Std., Pauschal, km, %
- Antworte immer auf Deutsch, präzise und ohne Floskeln
- Wenn Informationen fehlen, frage gezielt nach`;

  const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  // Erste LLM-Anfrage mit Tools
  const response = await invokeLLM({
    messages: llmMessages,
    tools: TOOLS,
    tool_choice: "auto",
  } as any);

  const choice = response.choices[0];
  const message = choice?.message;

  // Kein Tool-Aufruf — direkte Antwort
  if (!message?.tool_calls || message.tool_calls.length === 0) {
    const content = typeof message?.content === "string" ? message.content : "Keine Antwort erhalten.";
    return { reply: content };
  }

  // Tool-Aufrufe ausführen
  const toolCall = message.tool_calls[0];
  const toolName = toolCall.function?.name;
  const toolArgs = JSON.parse(toolCall.function?.arguments ?? "{}");

  let toolResult = "";
  let documentCreated: { type: string; id: number | null; recipient: string; totalGross: string } | undefined;

  if (toolName === "search_customer") {
    toolResult = await executeSearchCustomer(toolArgs.query);
  } else if (toolName === "create_document") {
    toolResult = await executeCreateDocument(toolArgs);
    const parsed = JSON.parse(toolResult);
    if (parsed.success) {
      documentCreated = {
        type: parsed.type,
        id: parsed.documentId,
        recipient: parsed.recipient,
        totalGross: parsed.totalGross,
      };
    }
  } else {
    toolResult = JSON.stringify({ error: "Unbekanntes Tool" });
  }

  // Zweite LLM-Anfrage mit Tool-Ergebnis
  const followUpMessages: any[] = [
    ...llmMessages,
    {
      role: "assistant",
      content: message.content ?? null,
      tool_calls: message.tool_calls,
    },
    {
      role: "tool",
      tool_call_id: toolCall.id,
      content: toolResult,
    },
  ];

  const followUp = await invokeLLM({ messages: followUpMessages, tools: TOOLS, tool_choice: "auto" } as any);
  const followUpChoice = followUp.choices[0];
  const followUpMessage = followUpChoice?.message;

  // Ggf. zweiten Tool-Aufruf ausführen (z.B. erst search_customer, dann create_document)
  if (followUpMessage?.tool_calls && followUpMessage.tool_calls.length > 0) {
    const toolCall2 = followUpMessage.tool_calls[0];
    const toolName2 = toolCall2.function?.name;
    const toolArgs2 = JSON.parse(toolCall2.function?.arguments ?? "{}");
    let toolResult2 = "";

    if (toolName2 === "search_customer") {
      toolResult2 = await executeSearchCustomer(toolArgs2.query);
    } else if (toolName2 === "create_document") {
      toolResult2 = await executeCreateDocument(toolArgs2);
      const parsed2 = JSON.parse(toolResult2);
      if (parsed2.success) {
        documentCreated = {
          type: parsed2.type,
          id: parsed2.documentId,
          recipient: parsed2.recipient,
          totalGross: parsed2.totalGross,
        };
      }
    }

    const finalMessages: any[] = [
      ...followUpMessages,
      {
        role: "assistant",
        content: followUpMessage.content ?? null,
        tool_calls: followUpMessage.tool_calls,
      },
      {
        role: "tool",
        tool_call_id: toolCall2.id,
        content: toolResult2,
      },
    ];

    const finalResponse = await invokeLLM({ messages: finalMessages } as any);
    const finalContent = finalResponse.choices[0]?.message?.content;
    return {
      reply: typeof finalContent === "string" ? finalContent : "Dokument wurde erstellt.",
      documentCreated,
    };
  }

  const finalContent = followUpMessage?.content;
  return {
    reply: typeof finalContent === "string" ? finalContent : "Keine Antwort erhalten.",
    documentCreated,
  };
}
